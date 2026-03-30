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
  genre_code: string | null;
  label_en: string | null;
  label_ru: string | null;
  header_images: unknown;
}

interface PublicArtistDto {
  name: string;
  publicSlug: string;
  genreCode: string;
  genreLabel: { en: string; ru: string };
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
         u.genre_code,
         g.label_en,
         g.label_ru,
         u.header_images
       FROM users u
       JOIN genres g ON g.code = u.genre_code
       WHERE u.is_active = true
         AND u.public_slug IS NOT NULL
       ORDER BY u.id ASC`
    );

    const artists: PublicArtistDto[] = rows.rows.map((row) => {
      const genreCode = row.genre_code || 'other';
      const genreLabel = {
        en: row.label_en || 'Other',
        ru: row.label_ru || 'Другое',
      };
      const displayName = row.site_name || row.name || row.public_slug || 'Unknown artist';

      const headerImagesRaw = Array.isArray(row.header_images) ? row.header_images : [];
      const headerImageUrls = headerImagesRaw
        .map((image) => String(image))
        .map((image) => toHeaderImageUrl(row.id, image))
        .filter(Boolean);

      return {
        name: displayName,
        publicSlug: row.public_slug || '',
        genreCode,
        genreLabel,
        headerImages: headerImageUrls,
      };
    });

    return createSuccessResponse(artists);
  } catch (error) {
    console.error('❌ [public-artists] failed:', error);
    return createErrorResponse(500, 'Failed to load public artists');
  }
};
