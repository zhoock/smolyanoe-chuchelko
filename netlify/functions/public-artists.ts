import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
} from './lib/api-helpers';

interface PublicArtistRow {
  id: string;
  name: string | null;
  site_name: string | null;
  public_slug: string | null;
  header_images: unknown;
  details: unknown;
}

interface PublicArtistDto {
  name: string;
  publicSlug: string;
  genre: string;
  mood: string;
  headerImages: string[];
}

function toHeaderImageUrl(userId: string, image: string): string {
  const value = image.trim();
  if (!value) return '';

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/api/proxy-image') ||
    value.startsWith('/.netlify/functions/proxy-image')
  ) {
    return value;
  }

  const hasExt = /\.(jpg|jpeg|png|webp|gif)$/i.test(value);
  const path = value.startsWith('users/')
    ? value
    : `users/${userId}/hero/${hasExt ? value : `${value}.jpg`}`;

  return `/api/proxy-image?path=${encodeURIComponent(path)}`;
}

function extractGenreTokens(details: unknown): string[] {
  if (!Array.isArray(details)) return [];

  const genreBlock = details.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const title = String((item as { title?: unknown }).title ?? '').toLowerCase();
    return title.includes('genre') || title.includes('жанр');
  }) as { content?: unknown } | undefined;

  if (
    !genreBlock?.content ||
    !Array.isArray(genreBlock.content) ||
    genreBlock.content.length === 0
  ) {
    return [];
  }

  const raw = String(genreBlock.content[0] ?? '')
    .replace(/\.+$/, '')
    .trim();

  if (!raw) return [];

  return raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return createErrorResponse(405, 'Method not allowed. Use GET.');
  }

  try {
    const rows = await query<PublicArtistRow>(
      `SELECT
         u.id,
         u.name,
         u.site_name,
         u.public_slug,
         u.header_images,
         latest.details
       FROM users u
       LEFT JOIN LATERAL (
         SELECT details
         FROM albums
         WHERE user_id = u.id
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1
       ) latest ON true
       WHERE u.is_active = true
         AND u.public_slug IS NOT NULL
       ORDER BY u.id ASC`
    );

    const artists: PublicArtistDto[] = rows.rows.map((row) => {
      const tokens = extractGenreTokens(row.details);
      const genre = tokens[0] || 'other';
      const mood = tokens[1] || 'melancholic';
      const displayName = row.site_name || row.name || row.public_slug || 'Unknown artist';

      const headerImagesRaw = Array.isArray(row.header_images) ? row.header_images : [];
      const headerImageUrls = headerImagesRaw
        .map((image) => String(image))
        .map((image) => toHeaderImageUrl(row.id, image))
        .filter(Boolean);

      return {
        name: displayName,
        publicSlug: row.public_slug || '',
        genre,
        mood,
        headerImages: headerImageUrls,
      };
    });

    return createSuccessResponse(artists);
  } catch (error) {
    console.error('❌ [public-artists] failed:', error);
    return createErrorResponse(500, 'Failed to load public artists');
  }
};
