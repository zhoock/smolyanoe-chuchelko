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
        console.error('[save-track-text.ts] ❌ Album not found:', {
          albumId: data.albumId,
          lang: data.lang,
        });
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
      const albumUserId = albumResult.rows[0].user_id;

      console.log('[save-track-text.ts] Found album:', {
        albumId: data.albumId,
        lang: data.lang,
        albumDbId,
        albumUserId,
        isUserAlbum: albumUserId === userId,
        isPublicAlbum: albumUserId === null,
      });

      // Используем UPSERT для обновления или создания трека
      // Если трек не существует, он будет создан; если существует - обновлен
      console.log('[save-track-text.ts] Upserting track:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        albumDbId,
        contentLength: data.content.length,
      });

      // Сначала получаем информацию о треке, чтобы сохранить существующие данные
      const existingTrackResult = await query<{
        title: string | null;
        duration: number | null;
        src: string | null;
        order_index: number | null;
      }>(
        `SELECT title, duration, src, order_index 
         FROM tracks 
         WHERE album_id = $1 AND track_id = $2
         LIMIT 1`,
        [albumDbId, String(data.trackId)]
      );

      const existingTrack = existingTrackResult.rows[0];

      // Используем UPSERT для обновления или создания трека
      const upsertResult = await query(
        `INSERT INTO tracks (album_id, track_id, title, duration, src, content, authorship, order_index, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), NOW())
         ON CONFLICT (album_id, track_id)
         DO UPDATE SET
           content = EXCLUDED.content,
           authorship = EXCLUDED.authorship,
           updated_at = NOW()
         RETURNING id, content, authorship`,
        [
          albumDbId,
          String(data.trackId),
          existingTrack?.title || null,
          existingTrack?.duration || null,
          existingTrack?.src || null,
          data.content, // content теперь хранит полный текст напрямую
          data.authorship || null,
          existingTrack?.order_index || 0,
        ]
      );

      if (upsertResult.rows.length === 0) {
        console.error('[save-track-text.ts] ❌ Failed to upsert track:', {
          albumId: data.albumId,
          trackId: data.trackId,
          lang: data.lang,
          albumDbId,
        });
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Failed to save track',
          } as SaveTrackTextResponse),
        };
      }

      const savedRow = upsertResult.rows[0];

      // Также обновляем synced_lyrics, чтобы текст был синхронизирован
      // Разбиваем текст на строки с startTime: 0 (обычный текст, не синхронизированный)
      const syncedLyrics = data.content
        .split('\n')
        .map((line) => ({ text: line, startTime: 0 }))
        .filter((line) => line.text.trim().length > 0);

      try {
        await query(
          `INSERT INTO synced_lyrics (user_id, album_id, track_id, lang, synced_lyrics, authorship, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
           ON CONFLICT (user_id, album_id, track_id, lang)
           DO UPDATE SET 
             synced_lyrics = EXCLUDED.synced_lyrics,
             authorship = EXCLUDED.authorship,
             updated_at = NOW()`,
          [
            userId,
            data.albumId,
            String(data.trackId),
            data.lang,
            JSON.stringify(syncedLyrics),
            data.authorship || null,
          ],
          0 // Без retry
        );
        console.log('✅ Synced lyrics updated:', {
          albumId: data.albumId,
          trackId: data.trackId,
          lang: data.lang,
          linesCount: syncedLyrics.length,
        });
      } catch (syncError) {
        // Логируем ошибку, но не прерываем сохранение
        console.warn('⚠️ Failed to update synced_lyrics (non-critical):', syncError);
      }

      console.log('✅ Track text saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: data.content.length,
        savedContentLength: savedRow.content?.length || 0,
        hasAuthorship: data.authorship !== undefined,
        albumDbId,
        trackDbId: savedRow.id,
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
