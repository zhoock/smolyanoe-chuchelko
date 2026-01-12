/**
 * Netlify Serverless Function для сохранения и загрузки синхронизированных текстов песен.
 *
 * Поддерживает:
 * - GET: загрузка синхронизаций для трека
 * - POST: сохранение синхронизаций для трека
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
import { getUserIdFromEvent } from './lib/api-helpers';

interface SyncedLyricsRow {
  id: string;
  album_id: string;
  track_id: string;
  lang: string;
  synced_lyrics: any; // JSONB
  authorship: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SaveSyncedLyricsRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  syncedLyrics: Array<{
    text: string;
    startTime: number;
    endTime?: number;
  }>;
  authorship?: string;
}

interface SyncedLyricsResponse {
  success: boolean;
  data?: {
    syncedLyrics: Array<{
      text: string;
      startTime: number;
      endTime?: number;
    }>;
    authorship?: string;
  };
  message?: string;
  error?: string;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const startTime = Date.now();

  // Используем context.getRemainingTimeInMillis для Netlify Functions (если доступно)
  // Оставляем запас в 2 секунды для обработки ответа
  const maxExecutionTime =
    typeof context.getRemainingTimeInMillis === 'function'
      ? context.getRemainingTimeInMillis() - 2000
      : 8000; // Fallback: 8 секунд

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    // GET: загрузка синхронизаций
    if (event.httpMethod === 'GET') {
      const { albumId, trackId, lang } = event.queryStringParameters || {};

      if (!albumId || !trackId || !lang) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required parameters: albumId, trackId, lang',
          } as SyncedLyricsResponse),
        };
      }

      // Извлекаем user_id из токена (если есть) - для авторизованных пользователей
      const currentUserId = getUserIdFromEvent(event);

      console.log('[synced-lyrics.ts GET] Loading synced lyrics:', {
        albumId,
        trackId,
        lang,
        currentUserId,
      });

      // Сначала находим альбом по album_id и lang
      // Если пользователь авторизован, ищем сначала его альбом, затем любой публичный
      // Если не авторизован, ищем любой альбом (публичный или любой по album_id)
      let albumResult;
      if (currentUserId) {
        // Если пользователь авторизован, сначала ищем его альбом
        albumResult = await query<{ id: string; user_id: string | null }>(
          `SELECT id, user_id FROM albums 
           WHERE album_id = $1 AND lang = $2 AND user_id = $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [albumId, lang, currentUserId],
          0
        );

        // Если не нашли альбом пользователя, ищем любой публичный
        if (albumResult.rows.length === 0) {
          albumResult = await query<{ id: string; user_id: string | null }>(
            `SELECT id, user_id FROM albums 
             WHERE album_id = $1 AND lang = $2 AND (user_id IS NULL OR is_public = true)
             ORDER BY created_at DESC
             LIMIT 1`,
            [albumId, lang],
            0
          );
        }
      } else {
        // Если пользователь не авторизован, ищем любой альбом (публичный или любой по album_id)
        albumResult = await query<{ id: string; user_id: string | null }>(
          `SELECT id, user_id FROM albums 
           WHERE album_id = $1 AND lang = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [albumId, lang],
          0
        );
      }

      if (albumResult.rows.length === 0) {
        console.log('[synced-lyrics.ts GET] No album found:', {
          albumId,
          lang,
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: undefined,
          } as SyncedLyricsResponse),
        };
      }

      const albumDbId = albumResult.rows[0].id;
      const albumUserId = albumResult.rows[0].user_id;

      console.log('[synced-lyrics.ts GET] Found album:', {
        albumId,
        lang,
        albumDbId,
        albumUserId,
        isUserAlbum: albumUserId === currentUserId,
        isPublicAlbum: albumUserId === null,
      });

      // Теперь загружаем синхронизации для владельца альбома (albumUserId)
      // Если albumUserId null, это публичный альбом, но синхронизации могут быть сохранены с user_id = null
      let syncedResult;
      if (albumUserId === null) {
        // Если альбом публичный (user_id IS NULL), ищем синхронизации с user_id IS NULL
        syncedResult = await query<SyncedLyricsRow>(
          `SELECT synced_lyrics, authorship 
           FROM synced_lyrics 
           WHERE album_id = $1 AND track_id = $2 AND lang = $3
             AND user_id IS NULL
           ORDER BY updated_at DESC
           LIMIT 1`,
          [albumId, String(trackId), lang],
          0 // Без retry для GET запросов - они должны быть быстрыми
        );
      } else {
        // Если альбом принадлежит пользователю, ищем синхронизации для этого пользователя
        syncedResult = await query<SyncedLyricsRow>(
          `SELECT synced_lyrics, authorship 
           FROM synced_lyrics 
           WHERE album_id = $1 AND track_id = $2 AND lang = $3
             AND user_id = $4
           ORDER BY updated_at DESC
           LIMIT 1`,
          [albumId, String(trackId), lang, albumUserId],
          0 // Без retry для GET запросов - они должны быть быстрыми
        );
      }

      // Если нашли синхронизированный текст, возвращаем его
      if (syncedResult.rows.length > 0) {
        const row = syncedResult.rows[0];
        console.log('[synced-lyrics.ts GET] ✅ Found synced lyrics:', {
          linesCount: Array.isArray(row.synced_lyrics) ? row.synced_lyrics.length : 0,
          hasAuthorship: !!row.authorship,
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              syncedLyrics: row.synced_lyrics,
              authorship: row.authorship || undefined,
            },
          } as SyncedLyricsResponse),
        };
      }

      // Если синхронизированного текста нет, проверяем tracks.content

      if (albumResult.rows.length === 0) {
        console.log('[synced-lyrics.ts GET] No album found:', {
          albumId,
          lang,
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: undefined,
          } as SyncedLyricsResponse),
        };
      }

      // Загружаем текст из tracks.content
      console.log('[synced-lyrics.ts GET] Loading track text from tracks.content:', {
        albumId,
        trackId,
        lang,
        albumDbId,
      });

      const trackResult = await query<{ content: string | null; authorship: string | null }>(
        `SELECT content, authorship 
         FROM tracks 
         WHERE album_id = $1 AND track_id = $2
         LIMIT 1`,
        [albumDbId, String(trackId)],
        0
      );

      if (trackResult.rows.length === 0 || !trackResult.rows[0].content) {
        console.log('[synced-lyrics.ts GET] No track text found in tracks.content:', {
          albumId,
          trackId,
          lang,
          albumDbId,
          rowsFound: trackResult.rows.length,
          hasContent: trackResult.rows.length > 0 ? !!trackResult.rows[0].content : false,
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: undefined,
          } as SyncedLyricsResponse),
        };
      }

      // Преобразуем content в формат syncedLyrics (массив строк с startTime: 0)
      const content = trackResult.rows[0].content;
      const syncedLyrics = content
        .split('\n')
        .map((line) => ({ text: line, startTime: 0 }))
        .filter((line) => line.text.trim().length > 0);

      console.log('[synced-lyrics.ts GET] ✅ Found track text from tracks.content:', {
        linesCount: syncedLyrics.length,
        hasAuthorship: !!trackResult.rows[0].authorship,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            syncedLyrics,
            authorship: trackResult.rows[0].authorship || undefined,
          },
        } as SyncedLyricsResponse),
      };
    }

    // POST: сохранение синхронизаций
    if (event.httpMethod === 'POST') {
      const data: SaveSyncedLyricsRequest = JSON.parse(event.body || '{}');

      // Валидация данных
      if (!data.albumId || !data.trackId || !data.lang || !Array.isArray(data.syncedLyrics)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid request data. Required: albumId, trackId, lang, syncedLyrics[]',
          } as SyncedLyricsResponse),
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
            error: 'Unauthorized. Authentication required.',
          } as SyncedLyricsResponse),
        };
      }

      // Сохраняем в таблицу synced_lyrics (UPSERT) для пользователя
      // НЕ обновляем tracks.synced_lyrics и не ищем альбом - это лишние запросы
      // Синхронизации загружаются из synced_lyrics при загрузке альбомов
      console.log('[synced-lyrics.ts POST] Saving synced lyrics:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        userId,
        linesCount: data.syncedLyrics.length,
        hasAuthorship: data.authorship !== undefined,
      });

      try {
        const result = await query(
          `INSERT INTO synced_lyrics (user_id, album_id, track_id, lang, synced_lyrics, authorship, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
           ON CONFLICT (user_id, album_id, track_id, lang)
           DO UPDATE SET 
             synced_lyrics = EXCLUDED.synced_lyrics,
             authorship = EXCLUDED.authorship,
             updated_at = NOW()
           RETURNING id, user_id, album_id, track_id, lang`,
          [
            userId,
            data.albumId,
            String(data.trackId),
            data.lang,
            JSON.stringify(data.syncedLyrics),
            data.authorship || null,
          ],
          0 // Без retry для POST запросов
        );
        console.log('[synced-lyrics.ts POST] ✅ Saved to synced_lyrics table:', {
          albumId: data.albumId,
          trackId: data.trackId,
          lang: data.lang,
          savedId: result.rows[0]?.id,
          savedUserId: result.rows[0]?.user_id,
          linesCount: data.syncedLyrics.length,
        });
      } catch (saveError) {
        console.error('[synced-lyrics.ts POST] ❌ Error saving to synced_lyrics:', saveError);
        throw saveError;
      }

      console.log('✅ Synced lyrics saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        linesCount: data.syncedLyrics.length,
        hasAuthorship: data.authorship !== undefined,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Synced lyrics saved successfully',
        } as SyncedLyricsResponse),
      };
    }

    // Неподдерживаемый метод
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use GET or POST.',
      } as SyncedLyricsResponse),
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Error in synced-lyrics function:', {
      error: error instanceof Error ? error.message : error,
      executionTime,
      method: event.httpMethod,
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Проверяем, не таймаут ли это
    const isTimeout =
      errorMessage.includes('timeout') ||
      errorMessage.includes('terminated') ||
      executionTime >= maxExecutionTime;
    const statusCode = isTimeout ? 504 : 500;

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        message: errorMessage, // Добавляем message для совместимости с клиентом
      } as SyncedLyricsResponse),
    };
  }
};
