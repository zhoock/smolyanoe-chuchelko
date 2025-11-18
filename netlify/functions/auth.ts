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
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  };
  error?: string;
  message?: string;
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/auth', '') || '/';

    // Регистрация
    if (path === '/register' || path.endsWith('/register')) {
      const data: RegisterRequest = JSON.parse(event.body || '{}');

      if (!data.email || !data.password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Email and password are required',
          } as AuthResponse),
        };
      }

      // Проверяем, существует ли пользователь
      const existingUser = await query<UserRow>(
        `SELECT id FROM users WHERE email = $1`,
        [data.email.toLowerCase().trim()],
        0
      );

      if (existingUser.rows.length > 0) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User with this email already exists',
          } as AuthResponse),
        };
      }

      // Хешируем пароль
      const passwordHash = await bcrypt.hash(data.password, 10);

      // Создаём пользователя
      const result = await query<UserRow>(
        `INSERT INTO users (email, name, password_hash, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, email, name`,
        [data.email.toLowerCase().trim(), data.name || null, passwordHash],
        0
      );

      const user = result.rows[0];

      // Генерируем JWT токен
      const token = generateToken(user.id, user.email);

      console.log('✅ User registered:', { userId: user.id, email: user.email });

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
          },
        } as AuthResponse),
      };
    }

    // Вход
    if (path === '/login' || path.endsWith('/login')) {
      const data: LoginRequest = JSON.parse(event.body || '{}');

      if (!data.email || !data.password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Email and password are required',
          } as AuthResponse),
        };
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
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid email or password',
          } as AuthResponse),
        };
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User account is disabled',
          } as AuthResponse),
        };
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);

      if (!isPasswordValid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid email or password',
          } as AuthResponse),
        };
      }

      // Генерируем JWT токен
      const token = generateToken(user.id, user.email);

      console.log('✅ User logged in:', { userId: user.id, email: user.email });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
          },
        } as AuthResponse),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'Endpoint not found' }),
    };
  } catch (error) {
    console.error('❌ Error in auth function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
