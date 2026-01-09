/**
 * Netlify Function для аутентификации пользователей
 *
 * POST /api/auth/register - регистрация нового пользователя
 * POST /api/auth/login - вход пользователя
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { sanitizeUsernameCandidate } from './lib/username-helpers';
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
  username: string | null;
  password_hash: string;
  is_active: boolean;
}

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  siteName?: string;
  username?: string;
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
    username: string | null;
  };
}

type AuthResponse = ApiResponse<AuthData>;

const MAX_USERNAME_ATTEMPTS = 10;

async function ensureUniqueUsername(email: string, requested?: string): Promise<string> {
  const emailLocalPart = email.split('@')[0] || email;
  const requestedBase = requested && requested.trim().length > 0 ? requested.trim() : null;
  const baseCandidate = sanitizeUsernameCandidate(requestedBase || emailLocalPart);

  const fallbackBase =
    baseCandidate || sanitizeSubdomainCandidate(`user-${Date.now().toString(36)}`) || 'user';

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const candidate = sanitizeUsernameCandidate(`${fallbackBase}${suffix}`);
    if (!candidate) {
      continue;
    }

    const existing = await query<{ id: string }>(
      'SELECT id FROM users WHERE username = $1 LIMIT 1',
      [candidate],
      0
    );

    if (existing.rows.length === 0) {
      if (attempt > 0) {
        console.log('[auth] Подобран уникальный username с суффиксом', {
          email,
          requested,
          candidate,
        });
      }
      return candidate;
    }
  }

  const randomCandidate =
    sanitizeUsernameCandidate(`${fallbackBase}-${Math.random().toString(36).slice(2, 6)}`) ||
    `${fallbackBase}-${Math.floor(Math.random() * 1_000_000)}`;

  console.warn('[auth] Используем случайный username после превышения попыток', {
    email,
    requested,
    randomCandidate,
  });

  return randomCandidate;
}

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
      const normalizedEmail = data.email.toLowerCase().trim();

      const existingUser = await query<UserRow>(
        `SELECT id FROM users WHERE email = $1`,
        [normalizedEmail],
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
      const username = await ensureUniqueUsername(normalizedEmail, data.username);

      const result = await query<UserRow>(
        `INSERT INTO users (email, name, site_name, password, password_hash, username, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, email, name, username`,
        [normalizedEmail, data.name || null, siteName, data.password, passwordHash, username],
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
            username: user.username,
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
        `SELECT id, email, name, username, password_hash, is_active
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
          username: user.username,
        },
      });
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    return handleError(error, 'auth function');
  }
};
