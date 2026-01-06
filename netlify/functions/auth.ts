/**
 * Netlify Function для аутентификации пользователей
 *
 * POST /api/auth/register - регистрация нового пользователя
 * POST /api/auth/login - вход пользователя
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { generateToken } from './lib/jwt';
import * as bcrypt from 'bcryptjs';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  parseJsonBody,
  handleError,
} from './lib/api-helpers';
import type { ApiResponse } from './lib/types';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  is_active: boolean;
}

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  siteName?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthData {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

type AuthResponse = ApiResponse<AuthData>;

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    const path = event.path.replace('/.netlify/functions/auth', '') || '/';

    // Регистрация
    if (path === '/register' || path.endsWith('/register')) {
      const data = parseJsonBody<RegisterRequest>(event.body, {} as RegisterRequest);

      if (!data.email || !data.password) {
        return createErrorResponse(400, 'Email and password are required');
      }

      // Проверяем, существует ли пользователь
      const existingUser = await query<UserRow>(
        `SELECT id FROM users WHERE email = $1`,
        [data.email.toLowerCase().trim()],
        0
      );

      if (existingUser.rows.length > 0) {
        return createErrorResponse(409, 'User with this email already exists');
      }

      // Хешируем пароль для проверки при входе
      const passwordHash = await bcrypt.hash(data.password, 10);

      // Создаём пользователя (сохраняем пароль в открытом виде для админки и хеш для проверки)
      // siteName берем из name, если siteName не указан явно (для обратной совместимости)
      const siteName = data.siteName || data.name || null;
      const result = await query<UserRow>(
        `INSERT INTO users (email, name, site_name, password, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, email, name`,
        [data.email.toLowerCase().trim(), data.name || null, siteName, data.password, passwordHash],
        0
      );

      const user = result.rows[0];

      // Генерируем JWT токен
      const token = generateToken(user.id, user.email);

      return createSuccessResponse(
        {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
        201
      );
    }

    // Вход
    if (path === '/login' || path.endsWith('/login')) {
      const data = parseJsonBody<LoginRequest>(event.body, {} as LoginRequest);

      if (!data.email || !data.password) {
        return createErrorResponse(400, 'Email and password are required');
      }

      // Ищем пользователя
      const result = await query<UserRow>(
        `SELECT id, email, name, password_hash, is_active
         FROM users
         WHERE email = $1`,
        [data.email.toLowerCase().trim()],
        0
      );

      if (result.rows.length === 0) {
        return createErrorResponse(401, 'Invalid email or password');
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return createErrorResponse(403, 'User account is disabled');
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);

      if (!isPasswordValid) {
        return createErrorResponse(401, 'Invalid email or password');
      }

      // Генерируем JWT токен
      const token = generateToken(user.id, user.email);

      return createSuccessResponse({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    return handleError(error, 'auth function');
  }
};
