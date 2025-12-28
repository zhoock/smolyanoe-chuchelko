/**
 * Netlify Serverless Function для обновления названия трека.
 *
 * Поддерживает:
 * - POST: обновление названия трека
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
import { getUserIdFromEvent } from './lib/api-helpers';

interface UpdateTrackTitleRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  title: string;
}

interface UpdateTrackTitleResponse {
  success: boolean;
  message?: string;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // POST: обновление названия трека
    if (event.httpMethod === 'POST') {
      const data: UpdateTrackTitleRequest = JSON.parse(event.body || '{}');

      // Валидация данных
      if (!data.albumId || !data.trackId || !data.lang || !data.title) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid request data. Required: albumId, trackId, lang, title',
          } as UpdateTrackTitleResponse),
        };
      }

      // Извлекаем user_id из токена (обязательно для сохранения)
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Unauthorized. Authentication required.',
          } as UpdateTrackTitleResponse),
        };
      }

      // Находим альбом пользователя
      const albumResult = await query<{ id: string; user_id: string | null }>(
        `SELECT id, user_id FROM albums 
         WHERE album_id = $1 AND lang = $2
           AND user_id = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [data.albumId, data.lang, userId]
      );

      if (albumResult.rows.length === 0) {
        console.error('[update-track-title.ts] ❌ Album not found:', {
          albumId: data.albumId,
          lang: data.lang,
        });
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Album not found',
          } as UpdateTrackTitleResponse),
        };
      }

      const albumDbId = albumResult.rows[0].id;

      // Обновляем название трека
      const updateResult = await query<{ id: string; title: string }>(
        `UPDATE tracks 
         SET title = $1, updated_at = NOW()
         WHERE album_id = $2 AND track_id = $3
         RETURNING id, title`,
        [data.title.trim(), albumDbId, String(data.trackId)]
      );

      if (updateResult.rows.length === 0) {
        console.error('[update-track-title.ts] ❌ Track not found:', {
          albumId: data.albumId,
          trackId: data.trackId,
        });
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Track not found',
          } as UpdateTrackTitleResponse),
        };
      }

      console.log('[update-track-title.ts] ✅ Track title updated:', {
        albumId: data.albumId,
        trackId: data.trackId,
        newTitle: data.title,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Track title updated successfully',
        } as UpdateTrackTitleResponse),
      };
    }

    // Метод не поддерживается
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed',
      } as UpdateTrackTitleResponse),
    };
  } catch (error) {
    console.error('[update-track-title.ts] ❌ Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      } as UpdateTrackTitleResponse),
    };
  }
};
