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
  role: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  siteName?: string;
}

interface SlugRow {
  public_slug: string;
}

interface UsernameRow {
  username: string;
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
    role: 'user' | 'admin';
  };
}

type AuthResponse = ApiResponse<AuthData>;

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'artist';
}

async function generateUniquePublicSlug(
  siteName: string | null | undefined,
  name: string | null | undefined,
  email: string
): Promise<string> {
  const emailLocalPart = email.split('@')[0] || 'artist';
  const baseValue = siteName || name || emailLocalPart;
  const baseSlug = slugify(baseValue);

  const existingSlugs = await query<SlugRow>(
    `SELECT public_slug
     FROM users
     WHERE public_slug = $1
        OR public_slug LIKE $2`,
    [baseSlug, `${baseSlug}-%`],
    0
  );

  const usedSlugs = new Set(
    existingSlugs.rows.map((row) => row.public_slug).filter((slug): slug is string => !!slug)
  );

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function generateUniqueUsername(
  siteName: string | null | undefined,
  name: string | null | undefined,
  email: string
): Promise<string> {
  const emailLocalPart = email.split('@')[0] || 'artist';
  const baseValue = siteName || name || emailLocalPart;
  const baseUsername = slugify(baseValue);

  const existingUsernames = await query<UsernameRow>(
    `SELECT username
     FROM users
     WHERE username = $1
        OR username LIKE $2`,
    [baseUsername, `${baseUsername}-%`],
    0
  );

  const usedUsernames = new Set(
    existingUsernames.rows
      .map((row) => row.username)
      .filter((username): username is string => !!username)
  );

  if (!usedUsernames.has(baseUsername)) {
    return baseUsername;
  }

  let suffix = 2;
  while (usedUsernames.has(`${baseUsername}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseUsername}-${suffix}`;
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
      const normalizedEmail = data.email.toLowerCase().trim();
      const siteName = data.siteName || data.name || null;

      // Защита от race-condition: если сработает уникальный индекс на username/public_slug, делаем повтор.
      let result: Awaited<ReturnType<typeof query<UserRow>>> | null = null;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const publicSlug = await generateUniquePublicSlug(
            siteName,
            data.name || null,
            normalizedEmail
          );
          const username = await generateUniqueUsername(
            siteName,
            data.name || null,
            normalizedEmail
          );

          result = await query<UserRow>(
            `INSERT INTO users (email, name, username, site_name, public_slug, password, password_hash, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             RETURNING id, email, name, role`,
            [
              normalizedEmail,
              data.name || null,
              username,
              siteName,
              publicSlug,
              data.password,
              passwordHash,
            ],
            0
          );
          break;
        } catch (error: any) {
          const isUniqueViolation = error?.code === '23505';
          if (isUniqueViolation && attempt < 1) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }

      if (!result) {
        throw lastError || new Error('Failed to create user after retry');
      }

      const user = result.rows[0];

      // Генерируем JWT токен
      const token = generateToken(user.id, user.email, user.role === 'admin' ? 'admin' : 'user');

      return createSuccessResponse(
        {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role === 'admin' ? 'admin' : 'user',
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
        `SELECT id, email, name, password_hash, is_active, role
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
      const token = generateToken(user.id, user.email, user.role === 'admin' ? 'admin' : 'user');

      return createSuccessResponse({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role === 'admin' ? 'admin' : 'user',
        },
      });
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    return handleError(error, 'auth function');
  }
};
