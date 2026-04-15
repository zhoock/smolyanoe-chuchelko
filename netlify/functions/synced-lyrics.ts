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
import { PublicArtistResolverError, resolvePublicArtistUserId } from './lib/public-artist-resolver';

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
  /** @deprecated сохраняется в каноническую локаль (ru → en) */
  lang?: string;
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

type AlbumRowCanonical = { id: string; user_id: string | null; lang: string };

/** Канонический ряд альбома (ru → en): один источник текста и синхронизации. */
async function findCanonicalAlbumForUser(
  albumId: string,
  userId: string
): Promise<AlbumRowCanonical | null> {
  const r = await query<AlbumRowCanonical>(
    `SELECT id, user_id, lang FROM albums
     WHERE album_id = $1 AND user_id = $2 AND lang IN ('ru', 'en')
     ORDER BY CASE lang WHEN 'ru' THEN 0 WHEN 'en' THEN 1 END
     LIMIT 1`,
    [albumId, userId],
    0
  );
  return r.rows[0] ?? null;
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
      const { albumId, trackId, lang, artist } = event.queryStringParameters || {};

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

      const authUserId = getUserIdFromEvent(event);
      let targetUserId: string;

      if (artist) {
        try {
          targetUserId = await resolvePublicArtistUserId(artist);
        } catch (error) {
          if (error instanceof PublicArtistResolverError) {
            return {
              statusCode: error.statusCode,
              headers,
              body: JSON.stringify({
                success: false,
                error: error.message,
              } as SyncedLyricsResponse),
            };
          }
          throw error;
        }
      } else if (authUserId) {
        targetUserId = authUserId;
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required query parameter: artist',
          } as SyncedLyricsResponse),
        };
      }

      console.log('[synced-lyrics.ts GET] Loading synced lyrics:', {
        albumId,
        trackId,
        lang,
        targetUserId,
      });

      const albumRow = await findCanonicalAlbumForUser(albumId, targetUserId);

      if (!albumRow) {
        console.log('[synced-lyrics.ts GET] No album found:', {
          albumId,
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

      const albumDbId = albumRow.id;
      const albumUserId = albumRow.user_id;
      const canonicalLang = albumRow.lang === 'ru' ? 'ru' : 'en';

      console.log('[synced-lyrics.ts GET] Found canonical album:', {
        albumId,
        albumDbId,
        canonicalLang,
        albumUserId,
      });

      const syncedResult = await query<{
        synced_lyrics: unknown;
        authorship: string | null;
      }>(
        `SELECT synced_lyrics, authorship
         FROM synced_lyrics
         WHERE album_id = $1 AND track_id = $2 AND user_id = $3 AND lang = $4
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`,
        [albumId, String(trackId), albumUserId, canonicalLang],
        0
      );

      const row = syncedResult.rows[0];
      if (row) {
        console.log('[synced-lyrics.ts GET] ✅ Found synced lyrics (canonical):', {
          linesCount: Array.isArray(row.synced_lyrics) ? row.synced_lyrics.length : 0,
          hasAuthorship: !!row.authorship,
          canonicalLang,
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

      if (!data.albumId || !data.trackId || !Array.isArray(data.syncedLyrics)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid request data. Required: albumId, trackId, syncedLyrics[]',
          } as SyncedLyricsResponse),
        };
      }

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

      const canonAlbum = await findCanonicalAlbumForUser(data.albumId, userId);
      if (!canonAlbum) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Album not found',
          } as SyncedLyricsResponse),
        };
      }

      const storeLang = canonAlbum.lang === 'ru' ? 'ru' : 'en';

      console.log('[synced-lyrics.ts POST] Saving synced lyrics:', {
        albumId: data.albumId,
        trackId: data.trackId,
        storeLang,
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
            storeLang,
            JSON.stringify(data.syncedLyrics),
            data.authorship || null,
          ],
          0 // Без retry для POST запросов
        );
        console.log('[synced-lyrics.ts POST] ✅ Saved to synced_lyrics table:', {
          albumId: data.albumId,
          trackId: data.trackId,
          lang: storeLang,
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
        lang: storeLang,
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
