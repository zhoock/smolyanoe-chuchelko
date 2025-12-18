/**
 * Netlify Serverless Function для сохранения текста трека.
 *
 * Поддерживает:
 * - POST: сохранение текста трека и авторства
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
import { getUserIdFromEvent } from './lib/api-helpers';

interface SaveTrackTextRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  content: string;
  authorship?: string;
}

interface SaveTrackTextResponse {
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
    // POST: сохранение текста
    if (event.httpMethod === 'POST') {
      const data: SaveTrackTextRequest = JSON.parse(event.body || '{}');

      // Валидация данных
      if (!data.albumId || !data.trackId || !data.lang || !data.content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid request data. Required: albumId, trackId, lang, content',
          } as SaveTrackTextResponse),
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
          } as SaveTrackTextResponse),
        };
      }

      // Находим альбом по album_id и lang (может быть публичный или пользовательский)
      const albumResult = await query<{ id: string }>(
        `SELECT id FROM albums 
         WHERE album_id = $1 AND lang = $2 
         AND (user_id = $3 OR user_id IS NULL)
         ORDER BY user_id NULLS LAST, created_at DESC
         LIMIT 1`,
        [data.albumId, data.lang, userId]
      );

      if (albumResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Album not found',
          } as SaveTrackTextResponse),
        };
      }

      const albumDbId = albumResult.rows[0].id;

      // Обновляем трек в таблице tracks
      // Используем album_id (UUID) из таблицы albums и track_id (строка) для поиска
      const updateResult = await query(
        `UPDATE tracks 
         SET content = $1, authorship = $2, updated_at = NOW()
         WHERE album_id = $3 AND track_id = $4
         RETURNING id`,
        [
          data.content, // content теперь хранит полный текст напрямую
          data.authorship || null,
          albumDbId,
          String(data.trackId),
        ]
      );

      if (updateResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Track not found',
          } as SaveTrackTextResponse),
        };
      }

      console.log('✅ Track text saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: data.content.length,
        hasAuthorship: data.authorship !== undefined,
        albumDbId,
        trackDbId: updateResult.rows[0].id,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Track text saved successfully',
        } as SaveTrackTextResponse),
      };
    }

    // Неподдерживаемый метод
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed. Use POST.',
      } as SaveTrackTextResponse),
    };
  } catch (error) {
    console.error('❌ Error in save-track-text function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: errorMessage,
      } as SaveTrackTextResponse),
    };
  }
};
