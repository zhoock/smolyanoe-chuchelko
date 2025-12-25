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
  // Парсим details, если это строка (PostgreSQL может вернуть JSONB как строку)
  let details: unknown[] = [];
  if (album.details) {
    if (typeof album.details === 'string') {
      try {
        details = JSON.parse(album.details);
      } catch (error) {
        console.error('❌ Error parsing album.details as string:', error);
        details = [];
      }
    } else if (Array.isArray(album.details)) {
      details = album.details;
    } else if (typeof album.details === 'object') {
      // Если это объект, пытаемся преобразовать в массив
      details = [album.details];
    }
  }

  // Парсим release, если это строка
  let release: Record<string, unknown> = {};
  if (album.release) {
    if (typeof album.release === 'string') {
      try {
        release = JSON.parse(album.release);
      } catch (error) {
        console.error('❌ Error parsing album.release as string:', error);
        release = {};
      }
    } else if (typeof album.release === 'object') {
      release = album.release as Record<string, unknown>;
    }
  }

  // Парсим buttons, если это строка
  let buttons: Record<string, unknown> = {};
  if (album.buttons) {
    if (typeof album.buttons === 'string') {
      try {
        buttons = JSON.parse(album.buttons);
      } catch (error) {
        console.error('❌ Error parsing album.buttons as string:', error);
        buttons = {};
      }
    } else if (typeof album.buttons === 'object') {
      buttons = album.buttons as Record<string, unknown>;
    }
  }

  return {
    albumId: album.album_id,
    artist: album.artist,
    album: album.album,
    fullName: album.full_name,
    description: album.description,
    cover: album.cover, // Changed: now it's a string, no cast needed
    release,
    buttons,
    details,
    lang: album.lang,
    tracks: tracks.map((track) => {
      // PostgreSQL DECIMAL возвращается как строка, конвертируем в число
      // Обрабатываем случаи: null, пустая строка, невалидное значение
      let duration: number | undefined = undefined;
      if (track.duration != null) {
        const durationNum =
          typeof track.duration === 'string' ? parseFloat(track.duration) : Number(track.duration);
        // Проверяем, что это валидное положительное число
        if (Number.isFinite(durationNum) && durationNum > 0) {
          duration = durationNum;
        }
      }

      // Парсим synced_lyrics, если это строка (PostgreSQL может вернуть JSONB как строку)
      let syncedLyrics: unknown = undefined;
      if (track.synced_lyrics) {
        if (typeof track.synced_lyrics === 'string') {
          try {
            syncedLyrics = JSON.parse(track.synced_lyrics);
          } catch (error) {
            console.error('❌ Error parsing track.synced_lyrics as string:', error);
            syncedLyrics = track.synced_lyrics;
          }
        } else {
          syncedLyrics = track.synced_lyrics;
        }
      }

      // #region agent log
      if (syncedLyrics) {
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'albums.ts:193',
            message: 'Track syncedLyrics in mapAlbumToApiFormat',
            data: {
              trackId: track.track_id,
              syncedLyricsType: Array.isArray(syncedLyrics) ? 'array' : typeof syncedLyrics,
              syncedLyricsLength: Array.isArray(syncedLyrics) ? syncedLyrics.length : 0,
              hasStartTimeGreaterThanZero: Array.isArray(syncedLyrics)
                ? syncedLyrics.some((line: any) => line.startTime > 0)
                : false,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }).catch(() => {});
      }
      // #endregion

      return {
        id: track.track_id,
        title: track.title,
        duration,
        src: track.src || undefined,
        content: track.content || undefined,
        authorship: track.authorship || undefined,
        syncedLyrics: syncedLyrics || undefined,
      };
    }),
  };
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  // Игнорируем запросы к /cover/draft и /cover/commit - они должны обрабатываться отдельными функциями
  const path = event.path || '';
  if (path.includes('/cover/draft') || path.includes('/cover/commit')) {
    console.log(
      '[albums.ts] Ignoring cover request, should be handled by dedicated function:',
      path
    );
    return createErrorResponse(
      404,
      'This endpoint should be handled by upload-cover-draft or commit-cover function. Check netlify.toml redirects.'
    );
  }

  try {
    // GET: загрузка альбомов
    if (event.httpMethod === 'GET') {
      const { lang } = event.queryStringParameters || {};

      if (!validateLang(lang)) {
        return createErrorResponse(400, 'Invalid lang parameter. Must be "en" or "ru".');
      }

      // Для GET запросов авторизация не требуется - все альбомы публичные
      // Для POST/PUT/DELETE требуется авторизация (админка)
      const userId = event.httpMethod === 'GET' ? null : getUserIdFromEvent(event);

      // Возвращаем все альбомы для указанного языка
      const albumsResult = await query<AlbumRow>(
        `SELECT a.*
             FROM albums a
             WHERE a.lang = $1 
             ORDER BY a.created_at DESC`,
        [lang]
      );

      // Загружаем треки для каждого альбома
      const albumsWithTracks = await Promise.all(
        albumsResult.rows.map(async (album) => {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'albums.ts:243',
                message: 'Loading tracks for album - start',
                data: {
                  albumId: album.album_id,
                  albumDbId: album.id,
                  lang: album.lang,
                  userId: album.user_id,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'A',
              }),
            }).catch(() => {});
            // #endregion

            // Загружаем треки по строковому album_id, а не по UUID
            // Это позволяет находить треки для всех языковых версий альбома
            // Используем подзапрос с ROW_NUMBER для исключения дубликатов
            const tracksResult = await query<TrackRow>(
              `SELECT 
                ranked.track_id,
                ranked.title,
                ranked.duration,
                ranked.src,
                ranked.content,
                ranked.authorship,
                ranked.synced_lyrics,
                ranked.order_index
              FROM (
                SELECT 
                  t.track_id,
                  t.title,
                  t.duration,
                  t.src,
                  t.content,
                  t.authorship,
                  t.synced_lyrics,
                  t.order_index,
                  ROW_NUMBER() OVER (
                    PARTITION BY t.track_id 
                    ORDER BY t.order_index ASC, a.created_at DESC
                  ) as rn
                FROM tracks t
                INNER JOIN albums a ON t.album_id = a.id
                WHERE a.album_id = $1
                  AND a.lang = $2
              ) ranked
              WHERE ranked.rn = 1
              ORDER BY ranked.order_index ASC`,
              [album.album_id, album.lang]
            );

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'albums.ts:281',
                message: 'Tracks loaded from DB',
                data: {
                  albumId: album.album_id,
                  albumDbId: album.id,
                  lang: album.lang,
                  tracksCount: tracksResult.rows.length,
                  tracks: tracksResult.rows.map((t) => ({
                    trackId: t.track_id,
                    title: t.title,
                    src: t.src,
                    orderIndex: t.order_index,
                    hasTitle: !!t.title,
                    hasSrc: !!t.src,
                  })),
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'B',
              }),
            }).catch(() => {});
            // #endregion

            // 🔍 DEBUG: Логируем треки из БД
            if (album.album_id === '23-remastered') {
              console.log(`[albums.ts GET] 🔍 DEBUG for 23-remastered (${lang}):`, {
                albumId: album.album_id,
                albumDbId: album.id,
                lang,
                tracksCount: tracksResult.rows.length,
                tracks: tracksResult.rows.map((t) => ({
                  trackId: t.track_id,
                  title: t.title,
                  src: t.src,
                  hasTitle: !!t.title,
                  hasSrc: !!t.src,
                })),
              });
            }

            // Загружаем синхронизации из таблицы synced_lyrics для всех треков одним запросом
            // Используем DISTINCT ON для получения одной записи на трек
            const trackIds = tracksResult.rows.map((t) => t.track_id);
            let syncedLyricsMap = new Map<
              string,
              { synced_lyrics: unknown; authorship: string | null }
            >();

            if (trackIds.length > 0) {
              try {
                console.log(
                  `[albums.ts GET] Loading synced lyrics for album ${album.album_id}, tracks: ${trackIds.length}`,
                  {
                    albumId: album.album_id,
                    trackIds: trackIds.slice(0, 5), // Логируем только первые 5
                    lang,
                  }
                );
                // Загружаем все синхронизации для всех треков альбома одним запросом
                // Используем DISTINCT ON для получения одной записи на трек
                const syncedLyricsResult = await query<{
                  track_id: string;
                  synced_lyrics: unknown;
                  authorship: string | null;
                }>(
                  `SELECT DISTINCT ON (track_id)
                     track_id, synced_lyrics, authorship
                   FROM synced_lyrics 
                   WHERE album_id = $1 AND track_id = ANY($2::text[]) AND lang = $3
                   ORDER BY track_id, updated_at DESC NULLS LAST`,
                  [album.album_id, trackIds, lang]
                );

                // Создаём Map для быстрого поиска
                syncedLyricsResult.rows.forEach((row) => {
                  syncedLyricsMap.set(row.track_id, {
                    synced_lyrics: row.synced_lyrics,
                    authorship: row.authorship,
                  });
                });
                console.log(
                  `[albums.ts GET] ✅ Loaded ${syncedLyricsResult.rows.length} synced lyrics from synced_lyrics table for album ${album.album_id}`
                );
              } catch (syncedError) {
                // Если ошибка при загрузке синхронизаций, используем данные из tracks
                console.error('❌ [albums.ts GET] Error loading synced lyrics:', syncedError);
              }
            }

            // Объединяем данные треков с синхронизациями
            const tracksWithSyncedLyrics = tracksResult.rows.map((track) => {
              const syncedData = syncedLyricsMap.get(track.track_id);
              if (syncedData) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    location: 'albums.ts:401',
                    message: 'Merging synced lyrics with track',
                    data: {
                      albumId: album.album_id,
                      trackId: track.track_id,
                      hasSyncedData: !!syncedData,
                      syncedLyricsType: Array.isArray(syncedData.synced_lyrics)
                        ? 'array'
                        : typeof syncedData.synced_lyrics,
                      syncedLyricsLength: Array.isArray(syncedData.synced_lyrics)
                        ? syncedData.synced_lyrics.length
                        : 0,
                      hasStartTimeGreaterThanZero: Array.isArray(syncedData.synced_lyrics)
                        ? syncedData.synced_lyrics.some((line: any) => line.startTime > 0)
                        : false,
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'C',
                  }),
                }).catch(() => {});
                // #endregion
                return {
                  ...track,
                  synced_lyrics: syncedData.synced_lyrics,
                  // Используем authorship из synced_lyrics, если он есть, иначе из tracks
                  authorship: syncedData.authorship || track.authorship,
                };
              }
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: 'albums.ts:410',
                  message: 'Track has no synced lyrics data',
                  data: {
                    albumId: album.album_id,
                    trackId: track.track_id,
                    syncedLyricsMapSize: syncedLyricsMap.size,
                  },
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'run1',
                  hypothesisId: 'D',
                }),
              }).catch(() => {});
              // #endregion
              return track;
            });

            const mapped = mapAlbumToApiFormat(album, tracksWithSyncedLyrics);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'albums.ts:363',
                message: 'Album mapped to API format',
                data: {
                  albumId: mapped.albumId,
                  lang: mapped.lang,
                  tracksCount: mapped.tracks.length,
                  tracks: mapped.tracks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    src: t.src,
                    hasTitle: !!t.title,
                    hasSrc: !!t.src,
                  })),
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'C',
              }),
            }).catch(() => {});
            // #endregion

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

      let data: CreateAlbumRequest;
      try {
        data = parseJsonBody<CreateAlbumRequest>(event.body, {} as CreateAlbumRequest);
      } catch (error) {
        return createErrorResponse(
          400,
          error instanceof Error ? error.message : 'Invalid JSON body'
        );
      }

      // Логируем в console.log для Netlify
      console.log('📝 POST /api/albums - Request data:', {
        albumId: data.albumId,
        artist: data.artist,
        album: data.album,
        lang: data.lang,
        hasArtist: data.artist !== undefined,
        hasAlbum: data.album !== undefined,
        bodyKeys: Object.keys(data),
      });

      // Валидация данных
      if (!data.albumId || !data.artist || !data.album || !data.lang || !validateLang(data.lang)) {
        console.error('❌ POST /api/albums - Validation failed:', {
          missingFields: {
            albumId: !data.albumId,
            artist: !data.artist,
            album: !data.album,
            lang: !data.lang || !validateLang(data.lang),
          },
          receivedData: data,
        });
        return createErrorResponse(
          400,
          'Missing required fields: albumId, artist, album, lang (must be "en" or "ru")'
        );
      }

      // Все альбомы принадлежат пользователю
      const albumUserId = userId;

      // Создаём альбом пользователя
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
          albumUserId,
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
          false, // is_public всегда false, так как все альбомы принадлежат пользователю
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

        let data: UpdateAlbumRequest;
        try {
          data = parseJsonBody<UpdateAlbumRequest>(event.body, {} as UpdateAlbumRequest);
        } catch (error) {
          return createErrorResponse(
            400,
            error instanceof Error ? error.message : 'Invalid JSON body'
          );
        }

        // Логируем в console.log для Netlify

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
        console.log('[albums.ts PUT] Searching for existing album:', {
          albumId: data.albumId,
          lang: data.lang,
          userId,
        });

        let existingAlbumResult;
        try {
          existingAlbumResult = await query<AlbumRow>(
            `SELECT * FROM albums 
            WHERE album_id = $1 AND lang = $2 
            AND user_id = $3
            ORDER BY created_at DESC
            LIMIT 1`,
            [data.albumId, data.lang, userId]
          );
          console.log('[albums.ts PUT] Album search result:', {
            found: existingAlbumResult.rows.length > 0,
            rowsCount: existingAlbumResult.rows.length,
          });
        } catch (searchError) {
          console.error('❌ [albums.ts PUT] Error searching for album:', searchError);
          throw searchError;
        }

        if (existingAlbumResult.rows.length === 0) {
          console.warn('[albums.ts PUT] Album not found, returning 404:', {
            albumId: data.albumId,
            lang: data.lang,
            userId,
          });
          return createErrorResponse(404, 'Album not found or access denied.');
        }

        const existingAlbum = existingAlbumResult.rows[0];
        console.log('[albums.ts PUT] Found existing album:', {
          id: existingAlbum.id,
          albumId: existingAlbum.album_id,
          lang: existingAlbum.lang,
        });

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
        // is_public больше не используется, все альбомы принадлежат пользователю

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

        console.log('[albums.ts PUT] Executing update query:', {
          query: updateQuery.substring(0, 200),
          paramsCount: updateValues.length,
          fieldsCount: updateFields.length,
        });

        let updateResult;
        try {
          updateResult = await query<AlbumRow>(updateQuery, updateValues);
          console.log('[albums.ts PUT] Update query executed successfully:', {
            rowsUpdated: updateResult.rows.length,
          });
        } catch (updateError) {
          console.error('❌ [albums.ts PUT] Error executing update query:', updateError);
          console.error('❌ [albums.ts PUT] Update query was:', updateQuery);
          console.error('❌ [albums.ts PUT] Update values were:', updateValues);
          throw updateError;
        }

        if (updateResult.rows.length === 0) {
          console.error('❌ [albums.ts PUT] Update query returned 0 rows:', {
            albumId: data.albumId,
            existingAlbumId: existingAlbum.id,
          });
          return createErrorResponse(500, 'Album update failed: no rows affected.');
        }

        const updatedAlbum = updateResult.rows[0];

        // 🔍 DEBUG: Проверяем, что пришло из БД
        console.log('[albums.ts PUT] Raw cover from DB:', {
          type: typeof updatedAlbum.cover,
          value: updatedAlbum.cover,
          stringified: JSON.stringify(updatedAlbum.cover),
        });

        // Загружаем треки для обновлённого альбома
        let tracksResult;
        try {
          // Загружаем треки по строковому album_id, а не по UUID
          // Это позволяет находить треки для всех языковых версий альбома
          tracksResult = await query<TrackRow>(
            `SELECT 
              ranked.track_id,
              ranked.title,
              ranked.duration,
              ranked.src,
              ranked.content,
              ranked.authorship,
              ranked.synced_lyrics,
              ranked.order_index
            FROM (
              SELECT 
                t.track_id,
                t.title,
                t.duration,
                t.src,
                t.content,
                t.authorship,
                t.synced_lyrics,
                t.order_index,
                ROW_NUMBER() OVER (PARTITION BY t.track_id ORDER BY t.order_index ASC, a.created_at DESC) as rn
              FROM tracks t
              INNER JOIN albums a ON t.album_id = a.id
              WHERE a.album_id = $1
            ) ranked
            WHERE ranked.rn = 1
            ORDER BY ranked.order_index ASC`,
            [updatedAlbum.album_id]
          );
          console.log('[albums.ts PUT] Tracks loaded:', {
            count: tracksResult.rows.length,
          });
        } catch (tracksError) {
          console.error('❌ [albums.ts PUT] Error loading tracks:', tracksError);
          throw tracksError;
        }

        let mappedAlbum;
        try {
          mappedAlbum = mapAlbumToApiFormat(updatedAlbum, tracksResult.rows);
          console.log('[albums.ts PUT] Album mapped successfully');
        } catch (mapError) {
          console.error('❌ [albums.ts PUT] Error mapping album:', mapError);
          throw mapError;
        }

        // 🔍 DEBUG: Проверяем, что получилось после маппинга
        console.log('[albums.ts PUT] Mapped album:', {
          albumId: mappedAlbum.albumId,
          album: mappedAlbum.album, // Должно быть новое значение
          artist: mappedAlbum.artist,
          description: mappedAlbum.description?.substring(0, 50) || '',
          cover: mappedAlbum.cover,
          type: typeof mappedAlbum.cover,
          stringified: JSON.stringify(mappedAlbum.cover),
        });

        // Сохраняем в JSON через GitHub API (асинхронно, не блокируем ответ)
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          // Загружаем все альбомы пользователя для обновления JSON
          const allAlbumsResult = await query<AlbumRow>(
            `SELECT a.*
          FROM albums a
          WHERE a.lang = $1 
            AND a.user_id = $2
          ORDER BY a.created_at DESC`,
            [data.lang, userId]
          );

          // Загружаем треки для всех альбомов
          const allAlbumsWithTracks = await Promise.all(
            allAlbumsResult.rows.map(async (album) => {
              // Загружаем треки по строковому album_id, а не по UUID
              // Это позволяет находить треки для всех языковых версий альбома
              const tracksResult = await query<TrackRow>(
                `SELECT 
                  ranked.track_id,
                  ranked.title,
                  ranked.duration,
                  ranked.src,
                  ranked.content,
                  ranked.authorship,
                  ranked.synced_lyrics,
                  ranked.order_index
                FROM (
                  SELECT 
                    t.track_id,
                    t.title,
                    t.duration,
                    t.src,
                    t.content,
                    t.authorship,
                    t.synced_lyrics,
                    t.order_index,
                    ROW_NUMBER() OVER (PARTITION BY t.track_id ORDER BY t.order_index ASC, a.created_at DESC) as rn
                  FROM tracks t
                  INNER JOIN albums a ON t.album_id = a.id
                  WHERE a.album_id = $1
                ) ranked
                WHERE ranked.rn = 1
                ORDER BY ranked.order_index ASC`,
                [album.album_id]
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

    // DELETE: удаление трека или альбома (требует авторизации)
    // PATCH: обновление порядка треков
    if (event.httpMethod === 'PATCH') {
      try {
        const userId = requireAuth(event);
        if (!userId) {
          return createErrorResponse(401, 'Unauthorized. Please provide a valid token.');
        }

        const data = parseJsonBody<{
          albumId: string;
          lang: SupportedLang;
          trackOrders: Array<{ trackId: string; orderIndex: number }>;
        }>(event.body, {} as any);

        if (!data.albumId || !data.lang || !Array.isArray(data.trackOrders)) {
          return createErrorResponse(
            400,
            'Missing required fields: albumId, lang, trackOrders (array of {trackId, orderIndex})'
          );
        }

        console.log('🔄 PATCH /api/albums - Reorder tracks request:', {
          albumId: data.albumId,
          lang: data.lang,
          trackOrders: data.trackOrders,
          userId,
        });

        // Находим альбом пользователя
        const albumResult = await query<AlbumRow>(
          `SELECT id, album_id, lang, user_id FROM albums
           WHERE album_id = $1 AND lang = $2 AND user_id = $3
           ORDER BY created_at DESC
           LIMIT 1`,
          [data.albumId, data.lang, userId]
        );

        if (albumResult.rows.length === 0) {
          return createErrorResponse(404, 'Album not found.');
        }

        const album = albumResult.rows[0];

        // Обновляем order_index для каждого трека
        const updatePromises = data.trackOrders.map(({ trackId, orderIndex }) =>
          query(
            `UPDATE tracks 
             SET order_index = $1, updated_at = CURRENT_TIMESTAMP
             WHERE album_id = $2 AND track_id = $3
             RETURNING id`,
            [orderIndex, album.id, String(trackId)]
          )
        );

        await Promise.all(updatePromises);

        console.log('✅ PATCH /api/albums - Tracks reordered:', {
          albumId: data.albumId,
          lang: data.lang,
          tracksCount: data.trackOrders.length,
        });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            message: 'Tracks reordered successfully',
          }),
        };
      } catch (reorderError) {
        console.error('❌ Error in PATCH /api/albums:', reorderError);
        return handleError(reorderError, 'albums PATCH function');
      }
    }

    if (event.httpMethod === 'DELETE') {
      try {
        const userId = requireAuth(event);

        if (!userId) {
          return createErrorResponse(401, 'Unauthorized. Authentication required.');
        }

        // Проверяем query параметры для удаления трека
        const queryParams = event.queryStringParameters || {};
        const trackId = queryParams.trackId;
        const albumIdFromQuery = queryParams.albumId;
        const langFromQuery = queryParams.lang;

        // Если есть trackId в query параметрах, удаляем трек
        if (trackId && albumIdFromQuery && langFromQuery) {
          if (!validateLang(langFromQuery)) {
            return createErrorResponse(400, 'Invalid lang parameter. Must be "en" or "ru"');
          }

          console.log('🗑️ DELETE /api/albums - Delete track request:', {
            albumId: albumIdFromQuery,
            trackId,
            lang: langFromQuery,
            userId,
          });

          // Находим альбом пользователя по album_id и lang
          const albumResult = await query<AlbumRow>(
            `SELECT id, album_id, lang, user_id FROM albums
             WHERE album_id = $1 AND lang = $2
             AND user_id = $3
             ORDER BY created_at DESC
             LIMIT 1`,
            [albumIdFromQuery, langFromQuery, userId]
          );

          if (albumResult.rows.length === 0) {
            return createErrorResponse(404, 'Album not found.');
          }

          const album = albumResult.rows[0];

          // Сначала получаем информацию о треке, чтобы удалить файл из Storage
          const trackResult = await query<{ src: string | null }>(
            `SELECT src FROM tracks 
             WHERE album_id = $1 AND track_id = $2`,
            [album.id, String(trackId)]
          );

          if (trackResult.rows.length === 0) {
            return createErrorResponse(404, 'Track not found.');
          }

          const track = trackResult.rows[0];

          // Удаляем аудиофайл из Supabase Storage, если он есть
          if (track.src) {
            try {
              const { createClient } = await import('@supabase/supabase-js');
              const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
              const serviceRoleKey =
                process.env.SUPABASE_SERVICE_ROLE_KEY ||
                process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                '';

              if (supabaseUrl && serviceRoleKey) {
                const supabase = createClient(supabaseUrl, serviceRoleKey, {
                  auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                  },
                });

                const STORAGE_BUCKET_NAME = 'user-media';

                // Извлекаем путь к файлу из src
                // src может быть полным URL или относительным путем
                let storagePath: string;
                if (track.src.startsWith('http://') || track.src.startsWith('https://')) {
                  // Если это полный URL, извлекаем путь
                  // Формат Supabase Storage public URL:
                  // https://{project}.supabase.co/storage/v1/object/public/user-media/users/zhoock/audio/...
                  const urlMatch = track.src.match(/\/user-media\/(.+)$/);
                  if (urlMatch) {
                    storagePath = urlMatch[1];
                  } else {
                    // Альтернативный формат: путь после /audio/
                    const audioMatch = track.src.match(/\/audio\/(.+)$/);
                    if (audioMatch) {
                      storagePath = `users/zhoock/audio/${audioMatch[1]}`;
                    } else {
                      console.warn('⚠️ Could not extract storage path from src:', track.src);
                      storagePath = '';
                    }
                  }
                } else {
                  // Если это относительный путь, добавляем префикс
                  // Формат: /audio/albumId/fileName или users/zhoock/audio/albumId/fileName
                  if (track.src.startsWith('/audio/')) {
                    storagePath = `users/zhoock${track.src}`;
                  } else if (track.src.startsWith('users/')) {
                    storagePath = track.src;
                  } else {
                    // Если путь начинается не с /, добавляем полный путь
                    storagePath = `users/zhoock/audio/${track.src}`;
                  }
                }

                if (storagePath) {
                  const { error: deleteError } = await supabase.storage
                    .from(STORAGE_BUCKET_NAME)
                    .remove([storagePath]);

                  if (deleteError) {
                    console.warn('⚠️ Failed to delete audio file from storage:', {
                      path: storagePath,
                      error: deleteError,
                    });
                  } else {
                    console.log('✅ Audio file deleted from storage:', {
                      path: storagePath,
                      trackId,
                    });
                  }
                }
              }
            } catch (storageError) {
              console.warn(
                '⚠️ Error deleting audio file from storage (non-critical):',
                storageError
              );
              // Не блокируем удаление трека, если файл не удалился
            }
          }

          // Удаляем трек из базы данных
          const deleteTrackResult = await query(
            `DELETE FROM tracks 
             WHERE album_id = $1 AND track_id = $2
             RETURNING id`,
            [album.id, String(trackId)]
          );

          if (deleteTrackResult.rows.length === 0) {
            return createErrorResponse(404, 'Track not found.');
          }

          // Также удаляем синхронизированные тексты для этого трека
          await query(
            `DELETE FROM synced_lyrics 
             WHERE album_id = $1 AND track_id = $2 AND lang = $3`,
            [albumIdFromQuery, String(trackId), langFromQuery]
          );

          console.log('✅ DELETE /api/albums - Track deleted:', {
            albumId: albumIdFromQuery,
            trackId,
            lang: langFromQuery,
          });

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              message: 'Track deleted successfully',
            }),
          };
        }

        // Иначе удаляем альбом (оригинальная логика)
        let data: { albumId: string; lang: string };
        try {
          data = parseJsonBody<{ albumId: string; lang: string }>(
            event.body,
            {} as { albumId: string; lang: string }
          );
        } catch (error) {
          return createErrorResponse(
            400,
            error instanceof Error ? error.message : 'Invalid JSON body'
          );
        }

        if (!data.albumId || !data.lang || !validateLang(data.lang)) {
          return createErrorResponse(
            400,
            'Missing required fields: albumId, lang (must be "en" or "ru")'
          );
        }

        console.log('🗑️ DELETE /api/albums - Request data:', {
          albumId: data.albumId,
          lang: data.lang,
          userId,
        });

        // Сначала находим все записи альбома пользователя (все языковые версии)
        const findAlbumsResult = await query<AlbumRow>(
          `SELECT id, album_id, lang, user_id, cover FROM albums 
          WHERE album_id = $1 
            AND user_id = $2`,
          [data.albumId, userId]
        );

        if (findAlbumsResult.rows.length === 0) {
          return createErrorResponse(
            404,
            'Album not found or you do not have permission to delete it.'
          );
        }

        const albumIds = findAlbumsResult.rows.map((row) => row.id);
        const coversToDelete = findAlbumsResult.rows
          .map((row) => row.cover)
          .filter((cover): cover is string => !!cover);

        // Удаляем все треки альбома (для всех языковых версий)
        if (albumIds.length > 0) {
          await query(`DELETE FROM tracks WHERE album_id = ANY($1::uuid[])`, [albumIds]);
        }

        // Удаляем все синхронизированные тексты альбома пользователя (для всех языковых версий)
        await query(
          `DELETE FROM synced_lyrics 
          WHERE album_id = $1 
            AND user_id = $2`,
          [data.albumId, userId]
        );

        // Удаляем все языковые версии альбома пользователя
        const deleteResult = await query<AlbumRow>(
          `DELETE FROM albums 
          WHERE album_id = $1 
            AND user_id = $2
          RETURNING *`,
          [data.albumId, userId]
        );

        // Удаляем обложки альбома из Supabase Storage
        // Собираем все уникальные обложки из всех удаленных записей
        const uniqueCovers = Array.from(
          new Set(
            deleteResult.rows.map((row) => row.cover).filter((cover): cover is string => !!cover)
          )
        );

        if (uniqueCovers.length > 0) {
          try {
            // Импортируем Supabase клиент
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
            const serviceRoleKey =
              process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
              '';

            if (supabaseUrl && serviceRoleKey) {
              const supabase = createClient(supabaseUrl, serviceRoleKey, {
                auth: {
                  persistSession: false,
                  autoRefreshToken: false,
                  detectSessionInUrl: false,
                },
              });

              const STORAGE_BUCKET_NAME = 'user-media';

              // Формируем пути для всех вариантов всех обложек
              const allCoverPaths: string[] = [];
              for (const coverBaseName of uniqueCovers) {
                const coverVariants = [
                  `${coverBaseName}-64.webp`,
                  `${coverBaseName}-128.webp`,
                  `${coverBaseName}-448.webp`,
                  `${coverBaseName}-896.webp`,
                  `${coverBaseName}-1344.webp`,
                  `${coverBaseName}-64.jpg`,
                  `${coverBaseName}-128.jpg`,
                  `${coverBaseName}-448.jpg`,
                  `${coverBaseName}-896.jpg`,
                  `${coverBaseName}-1344.jpg`,
                ];

                const coverPaths = coverVariants.map((variant) => `users/zhoock/albums/${variant}`);
                allCoverPaths.push(...coverPaths);
              }

              // Удаляем все варианты всех обложек
              if (allCoverPaths.length > 0) {
                const { error: deleteError } = await supabase.storage
                  .from(STORAGE_BUCKET_NAME)
                  .remove(allCoverPaths);

                if (deleteError) {
                  console.warn('⚠️ Failed to delete cover files from storage:', deleteError);
                } else {
                  console.log('✅ Cover files deleted from storage:', {
                    albumId: data.albumId,
                    coversCount: uniqueCovers.length,
                    variantsCount: allCoverPaths.length,
                  });
                }
              }
            }
          } catch (coverDeleteError) {
            console.warn('⚠️ Error deleting cover files (non-critical):', coverDeleteError);
            // Не блокируем удаление альбома, если обложки не удалились
          }
        }

        console.log('✅ DELETE /api/albums - Album deleted:', {
          albumId: data.albumId,
          lang: data.lang,
        });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            message: 'Album deleted successfully',
          }),
        };
      } catch (deleteError) {
        console.error('❌ Error in DELETE /api/albums:', deleteError);
        return handleError(deleteError, 'albums DELETE function');
      }
    }

    // Неподдерживаемый метод
    return createErrorResponse(405, 'Method not allowed. Use GET, POST, PUT, PATCH, or DELETE.');
  } catch (error) {
    return handleError(error, 'albums function');
  }
};
