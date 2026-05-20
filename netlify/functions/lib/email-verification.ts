/**
 * Email verification helpers (token generation, DB updates)
 */

import crypto from 'node:crypto';
import { query } from './db';
import { sendVerificationEmail } from './email';

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 24;

export interface VerificationUserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_email_verified: boolean;
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export function verificationExpiresAt(): Date {
  const expires = new Date();
  expires.setHours(expires.getHours() + TOKEN_TTL_HOURS);
  return expires;
}

export async function assignVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken();
  const expiresAt = verificationExpiresAt();

  await query(
    `UPDATE users
     SET email_verification_token = $1,
         email_verification_expires_at = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [token, expiresAt.toISOString(), userId],
    0
  );

  return token;
}

export async function clearVerificationToken(userId: string): Promise<void> {
  await query(
    `UPDATE users
     SET email_verification_token = NULL,
         email_verification_expires_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId],
    0
  );
}

export async function markEmailVerified(userId: string): Promise<void> {
  await query(
    `UPDATE users
     SET is_email_verified = true,
         email_verification_token = NULL,
         email_verification_expires_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId],
    0
  );
}

export async function sendUserVerificationEmail(
  email: string,
  token: string,
  userName?: string | null
): Promise<{ success: boolean; error?: string }> {
  const siteUrl =
    process.env.URL ||
    process.env.NETLIFY_SITE_URL ||
    process.env.DEPLOY_PRIME_URL ||
    'http://localhost:8888';

  const verifyUrl = `${siteUrl.replace(/\/$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  return sendVerificationEmail({
    to: email,
    verifyUrl,
    userName: userName ?? undefined,
  });
}

export async function isUserEmailVerified(userId: string): Promise<boolean> {
  const result = await query<{ is_email_verified: boolean }>(
    `SELECT is_email_verified FROM users WHERE id = $1`,
    [userId],
    0
  );
  return Boolean(result.rows[0]?.is_email_verified);
}

export function mapAuthUser(user: VerificationUserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === 'admin' ? ('admin' as const) : ('user' as const),
    isEmailVerified: Boolean(user.is_email_verified),
  };
}
