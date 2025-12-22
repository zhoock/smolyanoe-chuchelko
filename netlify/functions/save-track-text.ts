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

      // Получаем данные существующего трека (если есть)
      // Трек должен существовать, так как сначала добавляется аудио, потом текст
      const existingTrackResult = await query<{
        title: string;
        duration: number | null;
        src: string | null;
        order_index: number;
      }>(
        `SELECT title, duration, src, order_index 
         FROM tracks 
         WHERE album_id = $1 AND track_id = $2
         LIMIT 1`,
        [albumDbId, String(data.trackId)]
      );

      // Если трек не найден в пользовательской версии, ищем в публичной
      let trackData: {
        title: string;
        duration: number | null;
        src: string | null;
        order_index: number;
      } | null = null;

      if (existingTrackResult.rows.length > 0) {
        trackData = existingTrackResult.rows[0];
        console.log('✅ [save-track-text] Found existing track:', {
          albumId: data.albumId,
          trackId: data.trackId,
          title: trackData.title,
        });
      } else {
        // Ищем трек в публичной версии альбома
        const publicAlbumResult = await query<{ id: string }>(
          `SELECT id FROM albums 
           WHERE album_id = $1 AND lang = $2 AND user_id IS NULL
           LIMIT 1`,
          [data.albumId, data.lang]
        );

        if (publicAlbumResult.rows.length > 0) {
          const publicAlbumDbId = publicAlbumResult.rows[0].id;
          const publicTrackResult = await query<{
            title: string;
            duration: number | null;
            src: string | null;
            order_index: number;
          }>(
            `SELECT title, duration, src, order_index 
             FROM tracks 
             WHERE album_id = $1 AND track_id = $2
             LIMIT 1`,
            [publicAlbumDbId, String(data.trackId)]
          );

          if (publicTrackResult.rows.length > 0) {
            trackData = publicTrackResult.rows[0];
            console.log(
              '✅ [save-track-text] Found track in public album, will copy to user album:',
              {
                albumId: data.albumId,
                trackId: data.trackId,
                title: trackData.title,
              }
            );
          }
        }
      }

      // Если трек не найден нигде - это ошибка, но используем минимальные данные
      if (!trackData) {
        console.warn('⚠️ [save-track-text] Track not found, using minimal data:', {
          albumId: data.albumId,
          trackId: data.trackId,
          albumDbId,
        });
        trackData = {
          title: `Track ${data.trackId}`,
          duration: null,
          src: null,
          order_index: 0,
        };
      }

      // Используем INSERT ... ON CONFLICT DO UPDATE для надежного сохранения
      // Это обновит существующий трек или создаст новый, если его нет
      await query(
        `INSERT INTO tracks (
          album_id, track_id, title, duration, src, content,
          authorship, order_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (album_id, track_id)
        DO UPDATE SET
          content = EXCLUDED.content,
          authorship = EXCLUDED.authorship,
          updated_at = NOW()`,
        [
          albumDbId,
          String(data.trackId),
          trackData.title,
          trackData.duration,
          trackData.src,
          data.content,
          data.authorship || null,
          trackData.order_index,
        ]
      );

      // Получаем обновленный трек для логирования
      const updatedTrackResult = await query<{ id: string }>(
        `SELECT id FROM tracks 
         WHERE album_id = $1 AND track_id = $2
         LIMIT 1`,
        [albumDbId, String(data.trackId)]
      );

      console.log('✅ Track text saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: data.content.length,
        hasAuthorship: data.authorship !== undefined,
        albumDbId,
        trackDbId: updatedTrackResult.rows[0]?.id || 'unknown',
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
