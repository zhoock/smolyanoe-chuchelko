/**
 * Утилиты для работы с JWT токенами
 */

import * as jwt from 'jsonwebtoken';

// Секретный ключ для подписи JWT (должен быть в переменных окружения)
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// expiresIn может быть строкой (например, "7d", "1h") или числом (секунды)
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as string | number;

export type UserRole = 'user' | 'admin';

export interface JWTPayload {
  userId: string;
  email: string;
  /** Старые токены могли выдаваться без поля — считаем user */
  role?: UserRole;
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
export function generateToken(userId: string, email: string, role: UserRole = 'user'): string {
  const payload: JWTPayload = {
    userId,
    email,
    role: role ?? 'user',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Верифицирует и декодирует JWT токен
 * @param token - JWT токен
 * @returns Декодированный payload или null, если токен невалиден
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
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

/**
 * Извлекает user_id из JWT токена из Authorization header
 * @param authHeader - Значение заголовка Authorization (например, "Bearer <token>")
 * @returns user_id или null, если токен невалиден или отсутствует
 */
export function extractUserIdFromToken(authHeader: string | undefined): string | null {
  const token = parseBearerToken(authHeader);
  if (!token) {
    return null;
  }
  const payload = verifyToken(token);

  if (!payload || !payload.userId) {
    return null;
  }

  return payload.userId;
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
