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

      // Извлекаем user_id из токена (если есть)
      const userId = getUserIdFromEvent(event);

      // Загружаем публичные альбомы (user_id IS NULL, is_public = true) и альбомы пользователя
      // Важно: используем DISTINCT ON для исключения дубликатов по album_id
      // ORDER BY с NULLS LAST означает: пользовательские записи (user_id NOT NULL)
      // будут выше публичных (user_id IS NULL), что правильно - "мои перекрывают публичные"
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
                  ROW_NUMBER() OVER (PARTITION BY t.track_id ORDER BY t.order_index ASC, a.created_at DESC) as rn
                FROM tracks t
                INNER JOIN albums a ON t.album_id = a.id
                WHERE a.album_id = $1
              ) ranked
              WHERE ranked.rn = 1
              ORDER BY ranked.order_index ASC`,
              [album.album_id]
            );

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
            // Используем DISTINCT ON для приоритета пользовательских синхронизаций
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
                    userId,
                  }
                );
                // Загружаем все синхронизации для всех треков альбома одним запросом
                // Используем DISTINCT ON для получения одной записи на трек (приоритет: пользовательские)
                // ВАЖНО: DISTINCT ON требует, чтобы первая колонка в ORDER BY была такой же, как в DISTINCT ON
                const syncedLyricsResult = await query<{
                  track_id: string;
                  synced_lyrics: unknown;
                  authorship: string | null;
                }>(
                  `SELECT DISTINCT ON (track_id)
                     track_id, synced_lyrics, authorship
                   FROM synced_lyrics 
                   WHERE album_id = $1 AND track_id = ANY($2::text[]) AND lang = $3
                     AND (user_id = $4 OR user_id IS NULL)
                   ORDER BY track_id, user_id NULLS LAST, updated_at DESC`,
                  [album.album_id, trackIds, lang, userId || null]
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
                return {
                  ...track,
                  synced_lyrics: syncedData.synced_lyrics,
                  // Используем authorship из synced_lyrics, если он есть, иначе из tracks
                  authorship: syncedData.authorship || track.authorship,
                };
              }
              return track;
            });

            const mapped = mapAlbumToApiFormat(album, tracksWithSyncedLyrics);

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
            AND (user_id = $3 OR user_id IS NULL)
            ORDER BY user_id NULLS LAST, created_at DESC
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
          userId: existingAlbum.user_id,
          lang: existingAlbum.lang,
        });

        // Если найденный альбом - публичный (user_id IS NULL), а пользователь авторизован,
        // обновляем публичный альбом (это нормальное поведение для админки)
        if (existingAlbum.user_id === null && userId) {
          console.log('[albums.ts PUT] Public album found, will update public album');
        }

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

          // Находим альбом по album_id и lang
          const albumResult = await query<AlbumRow>(
            `SELECT id, album_id, lang, user_id FROM albums
             WHERE album_id = $1 AND lang = $2
             AND (user_id = $3 OR user_id IS NULL)
             ORDER BY user_id NULLS LAST, created_at DESC
             LIMIT 1`,
            [albumIdFromQuery, langFromQuery, userId]
          );

          if (albumResult.rows.length === 0) {
            return createErrorResponse(404, 'Album not found or access denied.');
          }

          const album = albumResult.rows[0];

          // Проверяем, что пользователь имеет право удалять треки из этого альбома
          // (альбом должен быть публичным или принадлежать пользователю)
          if (album.user_id !== null && album.user_id !== userId) {
            return createErrorResponse(
              403,
              'You do not have permission to delete tracks from this album.'
            );
          }

          // Удаляем трек
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

        // Удаляем альбом из БД (только если он принадлежит пользователю)
        const deleteResult = await query<AlbumRow>(
          `DELETE FROM albums 
          WHERE album_id = $1 AND lang = $2 AND user_id = $3
          RETURNING *`,
          [data.albumId, data.lang, userId]
        );

        if (deleteResult.rows.length === 0) {
          return createErrorResponse(
            404,
            'Album not found or you do not have permission to delete it.'
          );
        }

        // Удаляем треки альбома
        await query(`DELETE FROM tracks WHERE album_id = $1`, [deleteResult.rows[0].id]);

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
    return createErrorResponse(405, 'Method not allowed. Use GET, POST, PUT, or DELETE.');
  } catch (error) {
    return handleError(error, 'albums function');
  }
};
