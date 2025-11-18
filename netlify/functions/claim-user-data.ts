import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { extractUserIdFromToken } from './lib/jwt';

interface ClaimUserDataResult {
  success: boolean;
  message?: string;
  error?: string;
  updated?: {
    albums: number;
    tracks: number;
    syncedLyrics: number;
    articles: number;
  };
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
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const userId = extractUserIdFromToken(event.headers.authorization);

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const makePrivate = typeof body.makePrivate === 'boolean' ? body.makePrivate : true;

    const albumsResult = await query<{ id: string }>(
      `UPDATE albums
       SET user_id = $1,
           is_public = CASE WHEN $2::boolean THEN false ELSE is_public END,
           updated_at = NOW()
       WHERE user_id IS NULL
       RETURNING id`,
      [userId, makePrivate]
    );

    const albumIds = albumsResult.rows.map((row) => row.id);

    let tracksUpdated = 0;
    if (albumIds.length > 0) {
      const tracksResult = await query(
        `UPDATE tracks
         SET updated_at = NOW()
         WHERE album_id = ANY($1::uuid[])
         RETURNING id`,
        [albumIds]
      );
      tracksUpdated = tracksResult.rowCount;
    }

    const syncedResult = await query(
      `UPDATE synced_lyrics
       SET user_id = $1,
           updated_at = NOW()
       WHERE user_id IS NULL`,
      [userId]
    );

    const articlesResult = await query(
      `UPDATE articles
       SET user_id = $1,
           is_public = CASE WHEN $2::boolean THEN false ELSE is_public END,
           updated_at = NOW()
       WHERE user_id IS NULL`,
      [userId, makePrivate]
    );

    const result: ClaimUserDataResult = {
      success: true,
      message:
        albumsResult.rowCount === 0 && syncedResult.rowCount === 0 && articlesResult.rowCount === 0
          ? 'Нет данных для привязки'
          : 'Данные успешно привязаны к текущему пользователю',
      updated: {
        albums: albumsResult.rowCount,
        tracks: tracksUpdated,
        syncedLyrics: syncedResult.rowCount,
        articles: articlesResult.rowCount,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('❌ claim-user-data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
