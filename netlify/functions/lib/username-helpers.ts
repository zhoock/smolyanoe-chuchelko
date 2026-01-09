import { query } from './db';

export function sanitizeUsernameCandidate(candidate: string): string {
  return candidate
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export async function getUserByUsername(
  username: string | null
): Promise<{ id: string; username: string; email: string } | null> {
  if (!username) {
    return null;
  }

  const normalized = sanitizeUsernameCandidate(username);
  if (!normalized) {
    return null;
  }

  try {
    const result = await query<{ id: string; username: string; email: string }>(
      `SELECT id, username, email
       FROM users
       WHERE is_active = true
         AND (
           username = $1
           OR LOWER(split_part(email, '@', 1)) = $1
         )
       ORDER BY username = $1 DESC, updated_at DESC
       LIMIT 1`,
      [normalized]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('[getUserByUsername] Failed to fetch user:', error);
    return null;
  }
}
