/**
 * Netlify Serverless Function для сохранения и загрузки синхронизированных текстов песен.
 *
 * Поддерживает:
 * - GET: загрузка синхронизаций для трека
 * - POST: сохранение синхронизаций для трека
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
import { extractUserIdFromToken } from './lib/jwt';

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

  // Используем context.remainingTimeInMillis для Netlify Functions (если доступно)
  // Оставляем запас в 2 секунды для обработки ответа
  const maxExecutionTime = context.remainingTimeInMillis
    ? context.remainingTimeInMillis - 2000
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

      // Извлекаем user_id из токена (если есть)
      const userId = extractUserIdFromToken(event.headers.authorization);

      // Добавляем LIMIT 1 для оптимизации запроса
      // Приоритет: пользовательские синхронизации, затем публичные (user_id IS NULL)
      const result = await query<SyncedLyricsRow>(
        `SELECT synced_lyrics, authorship 
         FROM synced_lyrics 
         WHERE album_id = $1 AND track_id = $2 AND lang = $3
           AND (user_id = $4 OR user_id IS NULL)
         ORDER BY user_id NULLS LAST
         LIMIT 1`,
        [albumId, String(trackId), lang, userId],
        0 // Без retry для GET запросов - они должны быть быстрыми
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: null,
          } as SyncedLyricsResponse),
        };
      }

      const row = result.rows[0];
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
      const userId = extractUserIdFromToken(event.headers.authorization);

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

      // Сохраняем в БД (UPSERT)
      // Без retry для POST - они должны быть быстрыми или упасть сразу
      await query(
        `INSERT INTO synced_lyrics (user_id, album_id, track_id, lang, synced_lyrics, authorship, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
         ON CONFLICT (user_id, album_id, track_id, lang)
         DO UPDATE SET 
           synced_lyrics = $5::jsonb,
           authorship = $6,
           updated_at = NOW()`,
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

      console.log('✅ Synced lyrics saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        linesCount: data.syncedLyrics.length,
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
