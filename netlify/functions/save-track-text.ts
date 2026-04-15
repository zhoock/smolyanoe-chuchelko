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
  /** Локаль UI для поля authorship; текст песни сохраняется в канонический альбом (ru, иначе en). */
  lang: string;
  translations: Partial<Record<'en' | 'ru', { content: string; authorship?: string }>>;
}

interface SaveTrackTextResponse {
  success: boolean;
  message?: string;
}

/** Сравнимый «отпечаток» текста песни (без пустых строк), чтобы не сбрасывать тайм-коды при смене только авторства */
function lyricsFingerprintFromContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

function lyricsFingerprintFromSyncedLines(
  lines: Array<{ text?: unknown; startTime?: unknown }>
): string {
  return lines
    .map((l) => (typeof l.text === 'string' ? l.text.trim() : ''))
    .filter((l) => l.length > 0)
    .join('\n');
}

type AlbumLangRow = { id: string; lang: string };

async function findUserAlbumLangRows(userId: string, albumIdSlug: string): Promise<AlbumLangRow[]> {
  const r = await query<AlbumLangRow>(
    `SELECT id, lang FROM albums
     WHERE album_id = $1 AND user_id = $2 AND lang IN ('ru', 'en')
     ORDER BY CASE lang WHEN 'ru' THEN 0 WHEN 'en' THEN 1 END`,
    [albumIdSlug, userId],
    0
  );
  return r.rows;
}

function pickCanonicalAlbum(rows: AlbumLangRow[]): AlbumLangRow | null {
  if (!rows.length) return null;
  const ru = rows.find((x) => x.lang === 'ru');
  return ru ?? rows[0] ?? null;
}

function pickLocaleAlbum(rows: AlbumLangRow[], loc: 'en' | 'ru'): AlbumLangRow | null {
  return rows.find((x) => x.lang === loc) ?? pickCanonicalAlbum(rows);
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

      const raw = data as unknown as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(raw, 'content') && raw['content'] !== undefined) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Use translations[lang].content only, not root "content"',
          } as SaveTrackTextResponse),
        };
      }

      const locale = data.translations?.[data.lang as 'en' | 'ru'];
      const content = locale?.content;

      if (
        !data.albumId ||
        !data.trackId ||
        !data.lang ||
        content === undefined ||
        content === null
      ) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message:
              'Invalid request data. Required: albumId, trackId, lang, translations[lang].content',
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

      const uiLang = data.lang as 'en' | 'ru';
      if (uiLang !== 'en' && uiLang !== 'ru') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'lang must be "en" or "ru"',
          } as SaveTrackTextResponse),
        };
      }

      const albumRows = await findUserAlbumLangRows(userId, data.albumId);
      const canonicalAlbum = pickCanonicalAlbum(albumRows);
      const localeAlbum = pickLocaleAlbum(albumRows, uiLang);

      if (!canonicalAlbum || !localeAlbum) {
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

      const canonicalDbId = canonicalAlbum.id;
      const localeDbId = localeAlbum.id;
      const canonicalLang = canonicalAlbum.lang === 'ru' ? 'ru' : 'en';
      const sameAlbumRow = canonicalDbId === localeDbId;
      const authorshipVal = locale?.authorship ?? null;

      console.log('[save-track-text.ts] Found albums:', {
        albumId: data.albumId,
        uiLang,
        canonicalDbId,
        localeDbId,
        canonicalLang,
        sameAlbumRow,
        contentLength: content.length,
      });

      const existingCanonResult = await query<{
        title: string | null;
        duration: number | null;
        src: string | null;
        order_index: number | null;
        authorship: string | null;
      }>(
        `SELECT title, duration, src, order_index, authorship
         FROM tracks
         WHERE album_id = $1 AND track_id = $2
         LIMIT 1`,
        [canonicalDbId, String(data.trackId)],
        0
      );
      const existingCanon = existingCanonResult.rows[0];

      const upsertAuthorshipOnCanon = sameAlbumRow
        ? authorshipVal
        : (existingCanon?.authorship ?? null);

      const upsertResult = await query<{
        id: string;
        content: string | null;
        authorship: string | null;
      }>(
        sameAlbumRow
          ? `INSERT INTO tracks (album_id, track_id, title, duration, src, content, authorship, order_index, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), NOW())
             ON CONFLICT (album_id, track_id)
             DO UPDATE SET
               content = EXCLUDED.content,
               authorship = EXCLUDED.authorship,
               updated_at = NOW()
             RETURNING id, content, authorship`
          : `INSERT INTO tracks (album_id, track_id, title, duration, src, content, authorship, order_index, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), NOW())
             ON CONFLICT (album_id, track_id)
             DO UPDATE SET
               content = EXCLUDED.content,
               updated_at = NOW()
             RETURNING id, content, authorship`,
        [
          canonicalDbId,
          String(data.trackId),
          existingCanon?.title || null,
          existingCanon?.duration || null,
          existingCanon?.src || null,
          content,
          upsertAuthorshipOnCanon,
          existingCanon?.order_index || 0,
        ],
        0
      );

      if (upsertResult.rows.length === 0) {
        console.error('[save-track-text.ts] ❌ Failed to upsert canonical track:', {
          albumId: data.albumId,
          trackId: data.trackId,
          canonicalDbId,
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

      // EN-строка альбома может ещё не иметь строки в `tracks` — чистый UPDATE тогда не пишет authorship.
      if (!sameAlbumRow) {
        const canonMeta = await query<{
          title: string | null;
          duration: number | null;
          src: string | null;
          content: string | null;
          order_index: number | null;
        }>(
          `SELECT title, duration, src, content, order_index FROM tracks WHERE album_id = $1 AND track_id = $2 LIMIT 1`,
          [canonicalDbId, String(data.trackId)],
          0
        );
        const cm = canonMeta.rows[0];
        const rowContent = cm?.content ?? content ?? '';
        await query(
          `INSERT INTO tracks (album_id, track_id, title, duration, src, content, authorship, order_index, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), NOW())
           ON CONFLICT (album_id, track_id)
           DO UPDATE SET authorship = EXCLUDED.authorship, updated_at = NOW()`,
          [
            localeDbId,
            String(data.trackId),
            cm?.title ?? null,
            cm?.duration ?? null,
            cm?.src ?? null,
            rowContent,
            authorshipVal,
            cm?.order_index ?? 0,
          ],
          0
        );
      }

      const savedRow = upsertResult.rows[0];
      const syncAuthorshipMirror = savedRow.authorship ?? null;

      const newFingerprint = lyricsFingerprintFromContent(content);
      const plainLinesForInsert = content
        .split('\n')
        .map((line) => ({ text: line, startTime: 0 }))
        .filter((line) => line.text.trim().length > 0);

      let preserveExistingSyncedJson = false;

      try {
        const existingSync = await query<{ synced_lyrics: unknown }>(
          `SELECT synced_lyrics FROM synced_lyrics
           WHERE user_id = $1 AND album_id = $2 AND track_id = $3 AND lang = $4
           LIMIT 1`,
          [userId, data.albumId, String(data.trackId), canonicalLang],
          0
        );

        if (existingSync.rows.length > 0) {
          const raw = existingSync.rows[0].synced_lyrics;
          let parsed: Array<{ text?: unknown; startTime?: unknown }> = [];
          if (Array.isArray(raw)) {
            parsed = raw;
          } else if (typeof raw === 'string') {
            try {
              const v = JSON.parse(raw) as unknown;
              parsed = Array.isArray(v) ? v : [];
            } catch {
              parsed = [];
            }
          }
          if (parsed.length > 0) {
            const oldFp = lyricsFingerprintFromSyncedLines(parsed);
            if (oldFp === newFingerprint) {
              preserveExistingSyncedJson = true;
            }
          }
        }
      } catch (readErr) {
        console.warn('[save-track-text] Could not read existing synced_lyrics:', readErr);
      }

      try {
        if (preserveExistingSyncedJson) {
          await query(
            `UPDATE synced_lyrics
             SET authorship = $1, updated_at = NOW()
             WHERE user_id = $2 AND album_id = $3 AND track_id = $4 AND lang = $5`,
            [syncAuthorshipMirror, userId, data.albumId, String(data.trackId), canonicalLang],
            0
          );
          console.log('✅ Synced lyrics preserved (authorship mirror from canonical track):', {
            albumId: data.albumId,
            trackId: data.trackId,
            canonicalLang,
          });
        } else {
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
              canonicalLang,
              JSON.stringify(plainLinesForInsert),
              syncAuthorshipMirror,
            ],
            0
          );
          console.log('✅ Synced lyrics updated:', {
            albumId: data.albumId,
            trackId: data.trackId,
            canonicalLang,
            linesCount: plainLinesForInsert.length,
            resetTiming: true,
          });
        }
      } catch (syncError) {
        console.warn('⚠️ Failed to update synced_lyrics (non-critical):', syncError);
      }

      console.log('✅ Track text saved to database:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: content.length,
        savedContentLength: savedRow.content?.length || 0,
        hasAuthorship: locale?.authorship !== undefined,
        canonicalDbId,
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
