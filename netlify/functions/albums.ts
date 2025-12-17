/**
 * Netlify Serverless Function для работы с альбомами
 *
 * Поддерживает:
 * - GET: загрузка альбомов из БД (публичные + пользовательские)
 * - POST: создание нового альбома (требует авторизации)
 * - PUT: обновление альбома (требует авторизации)
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  CORS_HEADERS,
  validateLang,
  getUserIdFromEvent,
  requireAuth,
  parseJsonBody,
  handleError,
} from './lib/api-helpers';
import type { ApiResponse, SupportedLang } from './lib/types';
import { updateAlbumsJson } from './lib/github-api';

interface AlbumRow {
  id: string;
  user_id: string | null;
  album_id: string;
  artist: string;
  album: string;
  full_name: string;
  description: string;
  cover: string; // Changed from Record<string, unknown> to string
  release: Record<string, unknown>;
  buttons: Record<string, unknown>;
  details: unknown[];
  lang: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

interface TrackRow {
  id: string;
  track_id: string;
  title: string;
  duration: number | null;
  src: string | null;
  content: string | null;
  authorship: string | null;
  synced_lyrics: unknown | null;
  order_index: number;
}

interface AlbumData {
  albumId: string;
  artist: string;
  album: string;
  fullName: string;
  description: string;
  cover: string; // Changed from Record<string, unknown> to string
  release: Record<string, unknown>;
  buttons: Record<string, unknown>;
  details: unknown[];
  lang: string;
  tracks: TrackData[];
}

interface TrackData {
  id: string;
  title: string;
  duration?: number;
  src?: string;
  content?: string;
  authorship?: string;
  syncedLyrics?: unknown;
}

interface CreateAlbumRequest {
  albumId: string;
  artist: string;
  album: string;
  fullName?: string;
  description?: string;
  cover?: string; // Changed from Record<string, unknown> to string
  release?: Record<string, unknown>;
  buttons?: Record<string, unknown>;
  details?: unknown[];
  lang: SupportedLang;
  isPublic?: boolean;
}

interface UpdateAlbumRequest {
  albumId: string;
  artist?: string;
  album?: string;
  fullName?: string;
  description?: string;
  cover?: string; // Changed from Record<string, unknown> to string
  release?: Record<string, unknown>;
  buttons?: Record<string, unknown>;
  details?: unknown[];
  lang: SupportedLang;
  isPublic?: boolean;
}

type AlbumsResponse = ApiResponse<AlbumData[]>;

/**
 * Преобразует данные альбома из БД в формат API
 */
function mapAlbumToApiFormat(album: AlbumRow, tracks: TrackRow[]): AlbumData {
  return {
    albumId: album.album_id,
    artist: album.artist,
    album: album.album,
    fullName: album.full_name,
    description: album.description,
    cover: album.cover, // Changed: now it's a string, no cast needed
    release: album.release as Record<string, unknown>,
    buttons: album.buttons as Record<string, unknown>,
    details: album.details as unknown[],
    lang: album.lang,
    tracks: tracks.map((track) => ({
      id: track.track_id,
      title: track.title,
      // PostgreSQL DECIMAL возвращается как строка, конвертируем в число
      duration: track.duration != null ? Number(track.duration) : undefined,
      src: track.src || undefined,
      content: track.content || undefined,
      authorship: track.authorship || undefined,
      syncedLyrics: track.synced_lyrics || undefined,
    })),
  };
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  try {
    // GET: загрузка альбомов
    if (event.httpMethod === 'GET') {
      const { lang } = event.queryStringParameters || {};

      if (!validateLang(lang)) {
        return createErrorResponse(400, 'Invalid lang parameter. Must be "en" or "ru".');
      }

      // Извлекаем user_id из токена (если есть)
      const userId = getUserIdFromEvent(event);

      // Загружаем публичные альбомы (user_id IS NULL, is_public = true) и альбомы пользователя
      // Важно: используем DISTINCT ON для исключения дубликатов по album_id
      const albumsResult = await query<AlbumRow>(
        `SELECT DISTINCT ON (a.album_id) 
          a.*
        FROM albums a
        WHERE a.lang = $1 
          AND (
            (a.user_id IS NULL AND a.is_public = true)
            OR (a.user_id IS NOT NULL AND a.user_id = $2)
          )
        ORDER BY a.album_id, a.user_id NULLS LAST, a.created_at DESC`,
        [lang, userId || null]
      );

      // Загружаем треки для каждого альбома
      const albumsWithTracks = await Promise.all(
        albumsResult.rows.map(async (album) => {
          try {
            const tracksResult = await query<TrackRow>(
              `SELECT 
                t.track_id,
                t.title,
                t.duration,
                t.src,
                t.content,
                t.authorship,
                t.synced_lyrics
              FROM tracks t
              WHERE t.album_id = $1
              ORDER BY t.order_index ASC`,
              [album.id]
            );

            const mapped = mapAlbumToApiFormat(album, tracksResult.rows);

            return mapped;
          } catch (trackError) {
            throw trackError;
          }
        })
      );

      return createSuccessResponse(albumsWithTracks);
    }

    // POST: создание альбома (требует авторизации)
    if (event.httpMethod === 'POST') {
      const userId = requireAuth(event);

      if (!userId) {
        return createErrorResponse(401, 'Unauthorized. Authentication required.');
      }

      const data = parseJsonBody<CreateAlbumRequest>(event.body, {} as CreateAlbumRequest);

      // #region agent log
      const fs = require('fs');
      const logPath = '/Users/zhoock/Sites/my-project-copy/.cursor/debug.log';
      const logEntry =
        JSON.stringify({
          location: 'albums.ts:212',
          message: 'POST request received',
          data: {
            albumId: data.albumId,
            artist: data.artist,
            album: data.album,
            lang: data.lang,
            hasArtist: data.artist !== undefined,
            hasAlbum: data.album !== undefined,
            bodyKeys: Object.keys(data),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }) + '\n';
      try {
        fs.appendFileSync(logPath, logEntry);
      } catch (e) {
        // Ignore
      }
      // #endregion

      // Валидация данных
      if (!data.albumId || !data.artist || !data.album || !data.lang || !validateLang(data.lang)) {
        // #region agent log
        const errorLog =
          JSON.stringify({
            location: 'albums.ts:215',
            message: 'POST validation failed',
            data: {
              missingFields: {
                albumId: !data.albumId,
                artist: !data.artist,
                album: !data.album,
                lang: !data.lang || !validateLang(data.lang),
              },
              receivedData: data,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
          }) + '\n';
        try {
          fs.appendFileSync(logPath, errorLog);
        } catch (e) {
          // Ignore
        }
        // #endregion
        return createErrorResponse(
          400,
          'Missing required fields: albumId, artist, album, lang (must be "en" or "ru")'
        );
      }

      // Создаём альбом
      const albumResult = await query<AlbumRow>(
        `INSERT INTO albums (
          user_id, album_id, artist, album, full_name, description,
          cover, release, buttons, details, lang, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id, album_id, lang)
        DO UPDATE SET
          artist = EXCLUDED.artist,
          album = EXCLUDED.album,
          full_name = EXCLUDED.full_name,
          description = EXCLUDED.description,
          cover = EXCLUDED.cover,
          release = EXCLUDED.release,
          buttons = EXCLUDED.buttons,
          details = EXCLUDED.details,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [
          userId,
          data.albumId,
          data.artist,
          data.album,
          data.fullName || null,
          data.description || null,
          data.cover || null, // cover теперь строка, не jsonb!
          JSON.stringify(data.release || {}),
          JSON.stringify(data.buttons || {}),
          JSON.stringify(data.details || []),
          data.lang,
          data.isPublic || false,
        ]
      );

      const createdAlbum = mapAlbumToApiFormat(albumResult.rows[0], []);

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          message: 'Album created successfully',
          data: [createdAlbum],
        }),
      };
    }

    // PUT: обновление альбома (требует авторизации)
    if (event.httpMethod === 'PUT') {
      try {
        const userId = requireAuth(event);

        if (!userId) {
          return createErrorResponse(401, 'Unauthorized. Authentication required.');
        }

        const data = parseJsonBody<UpdateAlbumRequest>(event.body, {} as UpdateAlbumRequest);

        // #region agent log
        const fs = require('fs');
        const logPath = '/Users/zhoock/Sites/my-project-copy/.cursor/debug.log';
        const putLog =
          JSON.stringify({
            location: 'albums.ts:278',
            message: 'PUT request received',
            data: {
              albumId: data.albumId,
              artist: data.artist,
              album: data.album,
              lang: data.lang,
              hasArtist: data.artist !== undefined,
              hasAlbum: data.album !== undefined,
              bodyKeys: Object.keys(data),
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
          }) + '\n';
        try {
          fs.appendFileSync(logPath, putLog);
        } catch (e) {
          // Ignore
        }
        // #endregion

        console.log('📝 PUT /api/albums - Request data:', {
          albumId: data.albumId,
          lang: data.lang,
          hasArtist: data.artist !== undefined,
          hasAlbum: data.album !== undefined,
          hasDescription: data.description !== undefined,
          hasRelease: data.release !== undefined,
          hasButtons: data.buttons !== undefined,
          hasDetails: data.details !== undefined,
        });

        // Валидация данных
        if (!data.albumId || !data.lang || !validateLang(data.lang)) {
          return createErrorResponse(
            400,
            'Missing required fields: albumId, lang (must be "en" or "ru")'
          );
        }

        // Проверяем, существует ли альбом
        const existingAlbumResult = await query<AlbumRow>(
          `SELECT * FROM albums 
          WHERE album_id = $1 AND lang = $2 
          AND (user_id = $3 OR user_id IS NULL)
          ORDER BY user_id NULLS LAST, created_at DESC
          LIMIT 1`,
          [data.albumId, data.lang, userId]
        );

        if (existingAlbumResult.rows.length === 0) {
          return createErrorResponse(404, 'Album not found or access denied.');
        }

        const existingAlbum = existingAlbumResult.rows[0];

        // 🔍 DEBUG: Проверяем, что пришло в запросе
        console.log('[albums.ts PUT] Request data:', {
          albumId: data.albumId,
          cover: data.cover,
          coverType: typeof data.cover,
          coverUndefined: data.cover === undefined,
          coverNull: data.cover === null,
          coverEmpty: data.cover === '',
          allDataKeys: Object.keys(data),
        });

        // Подготавливаем данные для обновления
        const updateFields: string[] = [];
        const updateValues: unknown[] = [];
        let paramIndex = 1;

        if (data.artist !== undefined) {
          updateFields.push(`artist = $${paramIndex++}`);
          updateValues.push(data.artist);
        }
        if (data.album !== undefined) {
          updateFields.push(`album = $${paramIndex++}`);
          updateValues.push(data.album);
        }
        if (data.fullName !== undefined) {
          updateFields.push(`full_name = $${paramIndex++}`);
          updateValues.push(data.fullName);
        }
        if (data.description !== undefined) {
          updateFields.push(`description = $${paramIndex++}`);
          updateValues.push(data.description);
        }
        if (data.cover !== undefined && data.cover !== null && data.cover !== '') {
          updateFields.push(`cover = $${paramIndex++}::text`);
          updateValues.push(data.cover); // cover теперь строка, не jsonb!
          console.log('[albums.ts PUT] ✅ Cover will be updated to:', data.cover);
        } else {
          console.log('[albums.ts PUT] ⚠️ Cover NOT updated:', {
            cover: data.cover,
            undefined: data.cover === undefined,
            null: data.cover === null,
            empty: data.cover === '',
          });
        }
        if (data.release !== undefined) {
          updateFields.push(`release = $${paramIndex++}::jsonb`);
          updateValues.push(JSON.stringify(data.release));
        }
        if (data.buttons !== undefined) {
          updateFields.push(`buttons = $${paramIndex++}::jsonb`);
          updateValues.push(JSON.stringify(data.buttons));
        }
        if (data.details !== undefined) {
          updateFields.push(`details = $${paramIndex++}::jsonb`);
          updateValues.push(JSON.stringify(data.details));
        }
        if (data.isPublic !== undefined) {
          updateFields.push(`is_public = $${paramIndex++}`);
          updateValues.push(data.isPublic);
        }

        if (updateFields.length === 0) {
          return createErrorResponse(400, 'No fields to update.');
        }

        // Добавляем updated_at
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        // 🔍 DEBUG: Проверяем, что будет отправлено в БД
        console.log('[albums.ts PUT] Update query fields:', updateFields);
        console.log('[albums.ts PUT] Update query values:', updateValues);
        const coverIndex = updateFields.findIndex((f) => f.includes('cover'));
        if (coverIndex >= 0) {
          console.log('[albums.ts PUT] Cover will be updated:', {
            field: updateFields[coverIndex],
            value: updateValues[coverIndex],
          });
        } else {
          console.log('[albums.ts PUT] ⚠️ Cover NOT in updateFields!');
        }

        // Добавляем условия WHERE
        updateValues.push(existingAlbum.id);

        // Обновляем альбом в БД
        const updateQuery = `
        UPDATE albums 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

        const updateResult = await query<AlbumRow>(updateQuery, updateValues);

        const updatedAlbum = updateResult.rows[0];

        // 🔍 DEBUG: Проверяем, что пришло из БД
        console.log('[albums.ts PUT] Raw cover from DB:', {
          type: typeof updatedAlbum.cover,
          value: updatedAlbum.cover,
          stringified: JSON.stringify(updatedAlbum.cover),
        });

        // Загружаем треки для обновлённого альбома
        const tracksResult = await query<TrackRow>(
          `SELECT 
          t.track_id,
          t.title,
          t.duration,
          t.src,
          t.content,
          t.authorship,
          t.synced_lyrics
        FROM tracks t
        WHERE t.album_id = $1
        ORDER BY t.order_index ASC`,
          [updatedAlbum.id]
        );

        const mappedAlbum = mapAlbumToApiFormat(updatedAlbum, tracksResult.rows);

        // 🔍 DEBUG: Проверяем, что получилось после маппинга
        console.log('[albums.ts PUT] Mapped cover:', {
          type: typeof mappedAlbum.cover,
          value: mappedAlbum.cover,
          stringified: JSON.stringify(mappedAlbum.cover),
        });

        // Сохраняем в JSON через GitHub API (асинхронно, не блокируем ответ)
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          // Загружаем все альбомы для обновления JSON
          const allAlbumsResult = await query<AlbumRow>(
            `SELECT DISTINCT ON (a.album_id) 
            a.*
          FROM albums a
          WHERE a.lang = $1 
            AND (
              (a.user_id IS NULL AND a.is_public = true)
              OR (a.user_id IS NOT NULL AND a.user_id = $2)
            )
          ORDER BY a.album_id, a.user_id NULLS LAST, a.created_at DESC`,
            [data.lang, userId || null]
          );

          // Загружаем треки для всех альбомов
          const allAlbumsWithTracks = await Promise.all(
            allAlbumsResult.rows.map(async (album) => {
              const tracksResult = await query<TrackRow>(
                `SELECT 
                t.track_id,
                t.title,
                t.duration,
                t.src,
                t.content,
                t.authorship,
                t.synced_lyrics
              FROM tracks t
              WHERE t.album_id = $1
              ORDER BY t.order_index ASC`,
                [album.id]
              );

              return mapAlbumToApiFormat(album, tracksResult.rows);
            })
          );

          // Преобразуем в формат IAlbums для JSON
          const albumsForJson = allAlbumsWithTracks.map((album) => ({
            albumId: album.albumId,
            artist: album.artist,
            album: album.album,
            fullName: album.fullName,
            description: album.description,
            cover: album.cover,
            release: album.release,
            buttons: album.buttons,
            details: album.details,
            tracks: album.tracks.map((track) => {
              // track.id из API - это track_id (строка), нужно преобразовать в число для JSON
              const trackIdNumber =
                typeof track.id === 'string'
                  ? parseInt(track.id, 10) || 0
                  : typeof track.id === 'number'
                    ? track.id
                    : 0;

              return {
                id: trackIdNumber,
                title: track.title,
                duration: track.duration,
                src: track.src || '',
                content: track.content || '',
                authorship: track.authorship || undefined,
                syncedLyrics: track.syncedLyrics || undefined,
              };
            }),
          }));

          // Обновляем JSON файл (не ждём результата)
          updateAlbumsJson(data.lang, albumsForJson, data.albumId, githubToken).catch((error) => {
            console.error('❌ Failed to update JSON file in GitHub:', error);
          });
        } else {
          console.warn('⚠️ GITHUB_TOKEN not set, skipping JSON update');
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            message: 'Album updated successfully',
            data: [mappedAlbum],
          }),
        };
      } catch (putError) {
        console.error('❌ Error in PUT /api/albums:', putError);
        return handleError(putError, 'albums PUT function');
      }
    }

    // Неподдерживаемый метод
    return createErrorResponse(405, 'Method not allowed. Use GET, POST, or PUT.');
  } catch (error) {
    return handleError(error, 'albums function');
  }
};
