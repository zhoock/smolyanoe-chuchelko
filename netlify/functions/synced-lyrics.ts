/**
 * Netlify Serverless Function для сохранения и загрузки синхронизированных текстов песен.
 *
 * Поддерживает:
 * - GET: загрузка синхронизаций для трека
 * - POST: сохранение синхронизаций для трека
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';

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
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

      const result = await query<SyncedLyricsRow>(
        'SELECT synced_lyrics, authorship FROM synced_lyrics WHERE album_id = $1 AND track_id = $2 AND lang = $3',
        [albumId, String(trackId), lang]
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

      // Сохраняем в БД (UPSERT)
      await query(
        `INSERT INTO synced_lyrics (album_id, track_id, lang, synced_lyrics, authorship, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
         ON CONFLICT (album_id, track_id, lang)
         DO UPDATE SET 
           synced_lyrics = $4::jsonb,
           authorship = $5,
           updated_at = NOW()`,
        [
          data.albumId,
          String(data.trackId),
          data.lang,
          JSON.stringify(data.syncedLyrics),
          data.authorship || null,
        ]
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
    console.error('❌ Error in synced-lyrics function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as SyncedLyricsResponse),
    };
  }
};
