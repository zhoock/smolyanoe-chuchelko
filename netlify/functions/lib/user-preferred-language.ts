import { query } from './db';
import { normalizeEmailLocale, type EmailLocale } from './email-locale';

export async function updateUserPreferredLanguage(
  userId: string,
  preferredLanguage: EmailLocale
): Promise<void> {
  await query(
    `UPDATE users
     SET preferred_language = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2::uuid`,
    [preferredLanguage, userId],
    0
  );
}

export async function resolveEmailLocaleForAddress(
  email: string,
  fallback?: string | null
): Promise<EmailLocale> {
  const result = await query<{ preferred_language: string | null }>(
    `SELECT preferred_language
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email.trim()],
    0
  );

  const stored = result.rows[0]?.preferred_language;
  if (stored) {
    return normalizeEmailLocale(stored);
  }

  return normalizeEmailLocale(fallback);
}
