import { query } from './db';

interface UserIdRow {
  id: string;
}

export class PublicArtistResolverError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'PublicArtistResolverError';
  }
}

function normalizeArtistSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Resolves public artist owner user_id.
 * - If artist slug is provided, finds user by users.public_slug
 * - If absent, uses users.is_default_public_site = true
 * - Throws PublicArtistResolverError(404) when slug not found
 * - Throws PublicArtistResolverError(500) for configuration errors
 */
export async function resolvePublicArtistUserId(artistSlug?: string | null): Promise<string> {
  const normalizedSlug = artistSlug ? normalizeArtistSlug(artistSlug) : '';

  if (normalizedSlug) {
    const bySlug = await query<UserIdRow>(
      `SELECT id
       FROM users
       WHERE public_slug = $1 AND is_active = true
       LIMIT 1`,
      [normalizedSlug],
      0
    );

    if (bySlug.rows.length === 0) {
      throw new PublicArtistResolverError(404, `Artist not found: ${normalizedSlug}`);
    }

    return bySlug.rows[0].id;
  }

  const defaultUser = await query<UserIdRow>(
    `SELECT id
     FROM users
     WHERE is_default_public_site = true AND is_active = true
     LIMIT 2`,
    [],
    0
  );

  if (defaultUser.rows.length !== 1) {
    throw new PublicArtistResolverError(
      500,
      'Configuration error: exactly one default public user must exist'
    );
  }

  return defaultUser.rows[0].id;
}
