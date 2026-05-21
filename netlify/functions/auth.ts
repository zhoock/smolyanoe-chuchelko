/**
 * Netlify Function для аутентификации пользователей
 *
 * POST /api/auth/register - регистрация нового пользователя
 * POST /api/auth/login - вход пользователя
 * GET  /api/auth/verify-email?token=... - подтверждение email (редирект на фронт)
 * POST /api/auth/resend-verification - повторная отправка (JWT)
 * POST /api/auth/change-verification-email - смена email до верификации (JWT)
 * POST /api/auth/preferred-language - сохранить язык пользователя (JWT)
 * GET  /api/auth/me - текущий пользователь (JWT)
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { generateToken } from './lib/jwt';
import * as bcrypt from 'bcryptjs';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  CORS_HEADERS,
  parseJsonBody,
  handleError,
  requireAuth,
  unauthorizedFromAuthHeader,
} from './lib/api-helpers';
import type { ApiResponse } from './lib/types';
import {
  assignVerificationToken,
  mapAuthUser,
  markEmailVerified,
  sendUserVerificationEmail,
  type VerificationUserRow,
} from './lib/email-verification';
import {
  deleteUserAccount,
  DeleteAccountError,
  mapDeleteAccountError,
} from './lib/delete-user-account';
import { buildPublicAppPath } from './lib/public-app-url';
import { normalizeEmailLocale } from './lib/email-locale';
import { updateUserPreferredLanguage } from './lib/user-preferred-language';

interface UserRow extends VerificationUserRow {
  password_hash: string;
  is_active: boolean;
}

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  siteName?: string;
  preferredLanguage?: string;
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
  preferredLanguage?: string;
}

interface PreferredLanguageRequest {
  preferredLanguage?: string;
}

interface ChangeVerificationEmailRequest {
  email: string;
}

interface DeleteAccountRequest {
  currentPassword: string;
}

interface AuthData {
  token: string;
  user: ReturnType<typeof mapAuthUser>;
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

async function fetchUserById(userId: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT id, email, name, password_hash, is_active, role, is_email_verified, preferred_language
     FROM users
     WHERE id = $1`,
    [userId],
    0
  );
  return result.rows[0] ?? null;
}

function buildAuthPayload(user: UserRow): AuthData {
  const token = generateToken(user.id, user.email, user.role === 'admin' ? 'admin' : 'user');
  return { token, user: mapAuthUser(user) };
}

async function handleVerifyEmailGet(
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const token = event.queryStringParameters?.token?.trim();

  if (!token) {
    return {
      statusCode: 302,
      headers: {
        Location: buildPublicAppPath('/email-verification-expired?reason=missing'),
      },
      body: '',
    };
  }

  const result = await query<VerificationUserRow>(
    `SELECT id, email, name, role, is_email_verified
     FROM users
     WHERE email_verification_token = $1`,
    [token],
    0
  );

  if (result.rows.length === 0) {
    return {
      statusCode: 302,
      headers: {
        Location: buildPublicAppPath('/email-verification-expired?reason=invalid'),
      },
      body: '',
    };
  }

  const user = result.rows[0];

  if (user.is_email_verified) {
    return {
      statusCode: 302,
      headers: { Location: buildPublicAppPath('/email-verified?already=1') },
      body: '',
    };
  }

  const expiryCheck = await query<{ email_verification_expires_at: string | null }>(
    `SELECT email_verification_expires_at
     FROM users
     WHERE id = $1`,
    [user.id],
    0
  );

  const expiresAt = expiryCheck.rows[0]?.email_verification_expires_at;
  if (!expiresAt || new Date(expiresAt) < new Date()) {
    return {
      statusCode: 302,
      headers: {
        Location: buildPublicAppPath('/email-verification-expired?reason=expired'),
      },
      body: '',
    };
  }

  await markEmailVerified(user.id);

  return {
    statusCode: 302,
    headers: { Location: buildPublicAppPath('/email-verified') },
    body: '',
  };
}

async function handleResendVerification(
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const userId = requireAuth(event);
  if (!userId) {
    return unauthorizedFromAuthHeader(event);
  }

  const user = await fetchUserById(userId);
  if (!user) {
    return createErrorResponse(404, 'User not found');
  }

  if (!user.is_active) {
    return createErrorResponse(403, 'User account is disabled');
  }

  if (user.is_email_verified) {
    return createErrorResponse(400, 'Email is already verified', CORS_HEADERS, {
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  }

  const token = await assignVerificationToken(userId);
  const emailResult = await sendUserVerificationEmail(
    user.email,
    token,
    user.name,
    user.preferred_language
  );

  if (!emailResult.success) {
    return createErrorResponse(
      502,
      emailResult.error || 'Failed to send verification email',
      CORS_HEADERS,
      {
        code: 'EMAIL_SEND_FAILED',
      }
    );
  }

  return createSuccessResponse({ sent: true });
}

async function handleChangeVerificationEmail(
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const userId = requireAuth(event);
  if (!userId) {
    return unauthorizedFromAuthHeader(event);
  }

  const data = parseJsonBody<ChangeVerificationEmailRequest>(event.body, {
    email: '',
  } as ChangeVerificationEmailRequest);

  const newEmail = data.email?.toLowerCase().trim();
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return createErrorResponse(400, 'Valid email is required');
  }

  const user = await fetchUserById(userId);
  if (!user) {
    return createErrorResponse(404, 'User not found');
  }

  if (user.is_email_verified) {
    return createErrorResponse(400, 'Email is already verified', CORS_HEADERS, {
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  }

  if (newEmail !== user.email) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [newEmail, userId],
      0
    );
    if (existing.rows.length > 0) {
      return createErrorResponse(409, 'User with this email already exists');
    }

    await query(
      `UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newEmail, userId],
      0
    );
    user.email = newEmail;
  }

  const token = await assignVerificationToken(userId);
  const emailResult = await sendUserVerificationEmail(
    user.email,
    token,
    user.name,
    user.preferred_language
  );

  if (!emailResult.success) {
    return createErrorResponse(
      502,
      emailResult.error || 'Failed to send verification email',
      CORS_HEADERS,
      {
        code: 'EMAIL_SEND_FAILED',
      }
    );
  }

  const updated = await fetchUserById(userId);
  if (!updated) {
    return createErrorResponse(404, 'User not found');
  }

  return createSuccessResponse(buildAuthPayload(updated));
}

async function handlePreferredLanguage(
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const userId = requireAuth(event);
  if (!userId) {
    return unauthorizedFromAuthHeader(event);
  }

  const data = parseJsonBody<PreferredLanguageRequest>(event.body, {} as PreferredLanguageRequest);
  const preferredLanguage = normalizeEmailLocale(data.preferredLanguage);

  await updateUserPreferredLanguage(userId, preferredLanguage);

  const user = await fetchUserById(userId);
  if (!user) {
    return createErrorResponse(404, 'User not found');
  }

  return createSuccessResponse({ user: mapAuthUser(user) });
}

async function handleMe(
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const userId = requireAuth(event);
  if (!userId) {
    return unauthorizedFromAuthHeader(event);
  }

  const user = await fetchUserById(userId);
  if (!user) {
    return createErrorResponse(404, 'User not found');
  }

  return createSuccessResponse({ user: mapAuthUser(user) });
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  try {
    const path = event.path.replace('/.netlify/functions/auth', '') || '/';

    if (
      (path === '/verify-email' || path.endsWith('/verify-email')) &&
      event.httpMethod === 'GET'
    ) {
      return handleVerifyEmailGet(event);
    }

    if ((path === '/me' || path.endsWith('/me')) && event.httpMethod === 'GET') {
      return handleMe(event);
    }

    if (event.httpMethod !== 'POST') {
      return createErrorResponse(405, 'Method not allowed');
    }

    if (path === '/resend-verification' || path.endsWith('/resend-verification')) {
      return handleResendVerification(event);
    }

    if (path === '/change-verification-email' || path.endsWith('/change-verification-email')) {
      return handleChangeVerificationEmail(event);
    }

    if (path === '/preferred-language' || path.endsWith('/preferred-language')) {
      return handlePreferredLanguage(event);
    }

    if (path === '/delete-account' || path.endsWith('/delete-account')) {
      const userId = requireAuth(event);
      if (!userId) {
        return unauthorizedFromAuthHeader(event);
      }

      try {
        const body = parseJsonBody<DeleteAccountRequest>(event.body, {
          currentPassword: '',
        } as DeleteAccountRequest);
        const result = await deleteUserAccount(userId, body.currentPassword?.trim() ?? '');
        return createSuccessResponse(result);
      } catch (error) {
        if (error instanceof DeleteAccountError) {
          return createErrorResponse(error.statusCode, error.message, CORS_HEADERS, {
            code: error.code,
          });
        }
        const mapped = mapDeleteAccountError(error);
        return createErrorResponse(mapped.statusCode, mapped.message, CORS_HEADERS, {
          code: mapped.code,
        });
      }
    }

    // Регистрация
    if (path === '/register' || path.endsWith('/register')) {
      const data = parseJsonBody<RegisterRequest>(event.body, {} as RegisterRequest);

      if (!data.email || !data.password) {
        return createErrorResponse(400, 'Email and password are required');
      }

      const existingUser = await query<UserRow>(
        `SELECT id FROM users WHERE email = $1`,
        [data.email.toLowerCase().trim()],
        0
      );

      if (existingUser.rows.length > 0) {
        return createErrorResponse(409, 'User with this email already exists');
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const normalizedEmail = data.email.toLowerCase().trim();
      const siteName = data.siteName || data.name || null;
      const preferredLanguage = normalizeEmailLocale(data.preferredLanguage);

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
            `INSERT INTO users (
               email, name, username, site_name, public_slug, password, password_hash,
               is_active, is_email_verified, genre_code, preferred_language
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, 'other', $8)
             RETURNING id, email, name, role, is_email_verified, preferred_language`,
            [
              normalizedEmail,
              data.name || null,
              username,
              siteName,
              publicSlug,
              data.password,
              passwordHash,
              preferredLanguage,
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
      const verificationToken = await assignVerificationToken(user.id);
      const emailResult = await sendUserVerificationEmail(
        user.email,
        verificationToken,
        user.name,
        user.preferred_language
      );

      if (!emailResult.success) {
        console.error('⚠️ Verification email failed after register:', emailResult.error);
      }

      return createSuccessResponse(buildAuthPayload(user), 201);
    }

    // Вход
    if (path === '/login' || path.endsWith('/login')) {
      const data = parseJsonBody<LoginRequest>(event.body, {} as LoginRequest);

      if (!data.email || !data.password) {
        return createErrorResponse(400, 'Email and password are required');
      }

      const result = await query<UserRow>(
        `SELECT id, email, name, password_hash, is_active, role, is_email_verified, preferred_language
         FROM users
         WHERE email = $1`,
        [data.email.toLowerCase().trim()],
        0
      );

      if (result.rows.length === 0) {
        return createErrorResponse(401, 'Invalid email or password', CORS_HEADERS, {
          code: 'INVALID_CREDENTIALS',
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return createErrorResponse(403, 'User account is disabled');
      }

      const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);

      if (!isPasswordValid) {
        return createErrorResponse(401, 'Invalid email or password', CORS_HEADERS, {
          code: 'INVALID_CREDENTIALS',
        });
      }

      if (data.preferredLanguage) {
        await updateUserPreferredLanguage(user.id, normalizeEmailLocale(data.preferredLanguage));
        const refreshed = await fetchUserById(user.id);
        if (refreshed) {
          return createSuccessResponse(buildAuthPayload(refreshed));
        }
      }

      return createSuccessResponse(buildAuthPayload(user));
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    return handleError(error, 'auth function');
  }
};
