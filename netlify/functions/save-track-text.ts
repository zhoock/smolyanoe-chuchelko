/**
 * Netlify Serverless Function для сохранения текста трека.
 *
 * Поддерживает:
 * - POST: сохранение текста трека и авторства
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
import { extractUserIdFromToken } from './lib/jwt';

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
      const userId = extractUserIdFromToken(event.headers.authorization);

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

      // Сохраняем текст в БД
      // Преобразуем текст в массив строк для хранения в synced_lyrics
      // Каждая строка текста становится элементом массива без тайм-кодов
      const textLines = data.content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text) => ({ text, startTime: 0 })); // Без тайм-кодов, startTime = 0

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
          JSON.stringify(textLines), // Массив строк текста
          data.authorship || null,
        ]
      );

      console.log('✅ Track text saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: data.content.length,
        hasAuthorship: data.authorship !== undefined,
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
