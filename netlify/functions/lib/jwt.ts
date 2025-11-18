/**
 * Утилиты для работы с JWT токенами
 */

import jwt from 'jsonwebtoken';

// Секретный ключ для подписи JWT (должен быть в переменных окружения)
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// expiresIn может быть строкой (например, "7d", "1h") или числом (секунды)
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as string | number;

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Генерирует JWT токен для пользователя
 * @param userId - ID пользователя
 * @param email - Email пользователя
 * @returns JWT токен
 */
export function generateToken(userId: string, email: string): string {
  const payload: JWTPayload = {
    userId,
    email,
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

/**
 * Извлекает user_id из JWT токена из Authorization header
 * @param authHeader - Значение заголовка Authorization (например, "Bearer <token>")
 * @returns user_id или null, если токен невалиден или отсутствует
 */
export function extractUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Проверяем формат "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];
  const payload = verifyToken(token);

  if (!payload || !payload.userId) {
    return null;
  }

  return payload.userId;
}
