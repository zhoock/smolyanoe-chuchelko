/**
 * Утилиты для работы с JWT токенами
 *
 * Конфигурация (JWT_SECRET / JWT_EXPIRES_IN) централизована в этом модуле —
 * `getJwtSecret()` это единственная точка чтения секрета из окружения.
 * Не считывайте `process.env.JWT_SECRET` напрямую в других модулях.
 */

import * as jwt from 'jsonwebtoken';

/** Минимальная рекомендуемая длина секрета (HS256 ≥ 256 бит). */
const MIN_RECOMMENDED_SECRET_LENGTH = 32;

let cachedJwtSecret: string | null = null;

/**
 * Возвращает JWT-секрет из process.env.JWT_SECRET.
 *
 * Поведение:
 *  - Если переменная не задана или пуста после trim — бросает Error
 *    ('JWT_SECRET is required'). Никаких fallback-значений нет.
 *  - В production (NODE_ENV=production) для короткого секрета
 *    (< {@link MIN_RECOMMENDED_SECRET_LENGTH} символов) пишет warning, но
 *    не блокирует загрузку (поведение существующих деплоев не меняется).
 *  - Значение кэшируется, чтобы валидация и логи выполнялись один раз
 *    на процесс (cold-start функции).
 */
export function getJwtSecret(): string {
  if (cachedJwtSecret !== null) {
    return cachedJwtSecret;
  }

  const raw = process.env.JWT_SECRET;
  const secret = typeof raw === 'string' ? raw.trim() : '';

  if (!secret) {
    throw new Error(
      'JWT_SECRET is required. Set the JWT_SECRET environment variable (see .env.example).'
    );
  }

  if (process.env.NODE_ENV === 'production' && secret.length < MIN_RECOMMENDED_SECRET_LENGTH) {
    console.warn(
      `⚠️ JWT_SECRET is shorter than ${MIN_RECOMMENDED_SECRET_LENGTH} characters. ` +
        'Use a long random string in production (e.g. `openssl rand -base64 48`).'
    );
  }

  cachedJwtSecret = secret;
  return secret;
}

/** expiresIn может быть строкой (например, "7d", "1h") или числом (секунды). */
function getJwtExpiresIn(): string | number {
  return (process.env.JWT_EXPIRES_IN || '7d') as string | number;
}

export type UserRole = 'user' | 'admin';
export type AccountType = 'listener' | 'artist';

export interface JWTPayload {
  userId: string;
  email: string;
  /** Старые токены могли выдаваться без поля — считаем user */
  role?: UserRole;
  /** listener | artist; старые токены без поля — artist */
  accountType?: AccountType;
  iat?: number;
  exp?: number;
}

/**
 * Генерирует JWT токен для пользователя
 * @param userId - ID пользователя
 * @param email - Email пользователя
 * @param role - Роль (user | admin)
 * @returns JWT токен
 */
export function generateToken(
  userId: string,
  email: string,
  role: UserRole = 'user',
  accountType: AccountType = 'artist'
): string {
  const payload: JWTPayload = {
    userId,
    email,
    role: role ?? 'user',
    accountType: accountType ?? 'artist',
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  } as jwt.SignOptions);
}

/**
 * Верифицирует и декодирует JWT токен
 * @param token - JWT токен
 * @returns Декодированный payload или null, если токен невалиден
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('❌ JWT verification failed:', error);
    return null;
  }
}

function parseBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
}

/** Результат разбора заголовка Authorization (без маскировки истекшего токена под «нет artist»). */
export type AuthHeaderVerdict =
  | { kind: 'none' }
  | { kind: 'valid'; userId: string }
  | { kind: 'expired' }
  | { kind: 'invalid'; reason?: string };

/**
 * Проверяет JWT из Authorization: классифицирует отсутствие заголовка / истёкший / невалидный / ок.
 */
export function classifyAuthorizationHeader(authHeader: string | undefined): AuthHeaderVerdict {
  const token = parseBearerToken(authHeader);
  if (!token) {
    if (authHeader != null && authHeader.trim().length > 0) {
      return { kind: 'invalid', reason: 'malformed_authorization_header' };
    }
    return { kind: 'none' };
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
    if (!decoded.userId) {
      return { kind: 'invalid', reason: 'missing_user_id' };
    }
    return { kind: 'valid', userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { kind: 'expired' };
    }
    return {
      kind: 'invalid',
      reason: error instanceof Error ? error.message : 'verification_failed',
    };
  }
}

/**
 * Извлекает user_id из JWT токена из Authorization header
 * @param authHeader - Значение заголовка Authorization (например, "Bearer <token>")
 * @returns user_id или null, если токен невалиден или отсутствует
 */
export function extractUserIdFromToken(authHeader: string | undefined): string | null {
  const verdict = classifyAuthorizationHeader(authHeader);
  return verdict.kind === 'valid' ? verdict.userId : null;
}

/**
 * Роль из JWT (старые токены без поля role считаются user).
 */
export function extractRoleFromToken(authHeader: string | undefined): UserRole {
  const token = parseBearerToken(authHeader);
  if (!token) {
    return 'user';
  }
  const payload = verifyToken(token);
  if (!payload) {
    return 'user';
  }
  return payload.role === 'admin' ? 'admin' : 'user';
}

/** accountType из JWT (старые токены без поля — artist). */
export function extractAccountTypeFromToken(authHeader: string | undefined): AccountType {
  const token = parseBearerToken(authHeader);
  if (!token) {
    return 'artist';
  }
  const payload = verifyToken(token);
  if (!payload) {
    return 'artist';
  }
  return payload.accountType === 'listener' ? 'listener' : 'artist';
}

/**
 * Извлекает email из JWT токена из Authorization header
 * @param authHeader - Значение заголовка Authorization (например, "Bearer <token>")
 * @returns email или null, если токен невалиден или отсутствует
 */
export function extractEmailFromToken(authHeader: string | undefined): string | null {
  const token = parseBearerToken(authHeader);
  if (!token) {
    return null;
  }
  const payload = verifyToken(token);

  if (!payload || !payload.email) {
    return null;
  }

  return payload.email;
}
