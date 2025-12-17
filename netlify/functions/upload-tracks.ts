/**
 * Netlify Serverless Function для сохранения метаданных треков в базу данных
 *
 * ВАЖНО: Файлы должны быть загружены в Supabase Storage с клиента ДО вызова этой функции.
 * Эта функция только сохраняет метаданные в БД.
 *
 * Использование:
 * POST /api/tracks/upload
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * Body: {
 *   albumId: string (album_id, например "23"),
 *   lang: string ('ru' или 'en'),
 *   tracks: Array<{
 *     fileName: string,
 *     title: string,
 *     duration: number (в секундах),
 *     trackId: string (ID трека в альбоме, например "1", "2"),
 *     orderIndex: number,
 *     storagePath: string (путь к файлу в Storage),
 *     url: string (публичный URL файла)
 *   }>
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  parseJsonBody,
} from './lib/api-helpers';
import { query } from './lib/db';

interface TrackUploadRequest {
  albumId: string; // album_id (строка, например "23" или "23-remastered"), не UUID
  lang: string; // 'ru' или 'en'
  tracks: Array<{
    fileName: string;
    title: string;
    duration: number; // в секундах
    trackId: string; // ID трека в альбоме (например, "1", "2")
    orderIndex: number;
    storagePath: string; // Путь к файлу в Storage
    url: string; // URL файла в Storage
  }>;
}

interface TrackUploadResponse {
  success: boolean;
  data?: Array<{
    trackId: string;
    title: string;
    url: string;
    storagePath: string;
  }>;
  error?: string;
}

// Функция getStoragePath больше не нужна - файлы загружаются с клиента напрямую в Supabase Storage

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Проверяем авторизацию
    const userId = requireAuth(event);
    if (!userId) {
      return createErrorResponse(401, 'Unauthorized. Please provide a valid token.');
    }

    // Парсим JSON body
    const body = parseJsonBody<Partial<TrackUploadRequest>>(event.body, {});

    const { albumId, lang, tracks } = body;

    if (!albumId || !lang || !tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return createErrorResponse(
        400,
        'Missing required fields: albumId (string), lang (string), tracks (array with at least one track)'
      );
    }

    // Проверяем, что альбом существует и принадлежит пользователю
    // Ищем по album_id (строка) и lang, так как альбомы уникальны по (user_id, album_id, lang)
    const albumResult = await query<{ id: string; user_id: string | null }>(
      'SELECT id, user_id FROM albums WHERE album_id = $1 AND lang = $2 AND user_id = $3',
      [albumId, lang, userId]
    );

    if (albumResult.rows.length === 0) {
      return createErrorResponse(404, 'Album not found');
    }

    const album = albumResult.rows[0];
    if (album.user_id !== userId) {
      return createErrorResponse(403, 'Forbidden. You can only upload tracks to your own albums.');
    }

    const uploadedTracks: TrackUploadResponse['data'] = [];

    // Обрабатываем каждый трек
    // Файлы уже загружены в Supabase Storage с клиента, нам нужно только сохранить метаданные в БД
    for (const track of tracks) {
      const { fileName, title, duration, trackId, orderIndex, storagePath, url } = track;

      if (!fileName || !title || !trackId || !storagePath || !url) {
        console.warn('Skipping track with missing required fields:', { trackId, title, fileName });
        continue;
      }

      try {
        // Сохраняем трек в БД
        // Используем ON CONFLICT для обновления существующих треков
        // album.id - это UUID из БД, который используется как внешний ключ
        const insertResult = await query(
          `INSERT INTO tracks (
        album_id, track_id, title, duration, src, order_index
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (album_id, track_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        duration = EXCLUDED.duration,
        src = EXCLUDED.src,
        order_index = EXCLUDED.order_index,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, track_id, title`,
          [album.id, trackId, title, duration, url, orderIndex]
        );

        if (insertResult.rows.length > 0) {
          uploadedTracks.push({
            trackId,
            title,
            url,
            storagePath,
          });
        }
      } catch (trackError) {
        console.error('Error processing track:', {
          trackId,
          title,
          error: trackError instanceof Error ? trackError.message : String(trackError),
        });
        // Продолжаем обработку остальных треков
      }
    }

    if (uploadedTracks.length === 0) {
      return createErrorResponse(
        500,
        'Failed to upload any tracks. Check server logs for details.'
      );
    }

    return createSuccessResponse(
      {
        success: true,
        data: uploadedTracks,
      },
      200
    );
  } catch (error) {
    console.error('❌ Error in upload-tracks function:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
