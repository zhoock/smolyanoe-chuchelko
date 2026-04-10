/**
 * Netlify Serverless Function для работы с альбомами
 *
 * Поддерживает:
 * - GET: загрузка альбомов из БД (публичные + пользовательские)
 * - POST: создание нового альбома (требует авторизации)
 * - PUT: обновление альбома (требует авторизации)
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query, getClient } from './lib/db';
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
import { PublicArtistResolverError, resolvePublicArtistUserId } from './lib/public-artist-resolver';
import { resolveTrackSrcToSupabasePublicUrl } from './lib/storage-public-url';
import { normalizeTrackIdString } from '../../src/shared/lib/tracks/normalizeTrackIdString';
import { rankToOrderIndex } from '../../src/shared/lib/tracks/trackOrderIndex';
import { hydrateMissingRuTranslationsOnAlbum } from '../../src/entities/album/lib/hydrateMissingRuTranslations';
import type { IAlbums } from '../../src/models';

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

interface AlbumLocalePayload {
  album: string;
  fullName: string;
  description: string;
  details: unknown[];
}

interface AlbumData {
  userId?: string;
  albumId: string;
  artist: string;
  album: string;
  fullName: string;
  description: string;
  cover: string; // Changed from Record<string, unknown> to string
  release: Record<string, unknown>;
  buttons: Record<string, unknown>;
  details: unknown[];
  /** Присутствует у одноязычного ответа (POST и т.д.); у сливного GET отсутствует. */
  lang?: string;
  translations?: Partial<Record<SupportedLang, AlbumLocalePayload>>;
  tracks: TrackData[];
}

interface TrackLocalePayload {
  title: string;
  content?: string;
  authorship?: string;
  syncedLyrics?: unknown;
}

interface TrackData {
  id: string;
  title: string;
  order_index: number;
  duration?: number;
  src?: string;
  content?: string;
  authorship?: string;
  syncedLyrics?: unknown;
  translations?: Partial<Record<SupportedLang, TrackLocalePayload>>;
}

interface AlbumOwnerSlugRow {
  public_slug: string;
}

/** Переводимые поля альбома — только внутри translations[lang] (не дублировать в корне запроса). */
interface CreateAlbumRequest {
  albumId: string;
  translations: Partial<Record<SupportedLang, AlbumLocalePayload>>;
  cover?: string;
  release?: Record<string, unknown>;
  buttons?: Record<string, unknown>;
  lang: SupportedLang;
  isPublic?: boolean;
}

interface UpdateAlbumRequest {
  albumId: string;
  /** Частичное или полное обновление переводимых полей для lang. */
  translations?: Partial<Record<SupportedLang, Partial<AlbumLocalePayload>>>;
  cover?: string;
  release?: Record<string, unknown>;
  buttons?: Record<string, unknown>;
  lang: SupportedLang;
  isPublic?: boolean;
}

const LEGACY_ALBUM_TRANSLATABLE_ROOT = ['album', 'fullName', 'description', 'details'] as const;

function albumRequestHasForbiddenRootFields(body: Record<string, unknown>): string | null {
  for (const key of LEGACY_ALBUM_TRANSLATABLE_ROOT) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      return `"${key}" must be sent only inside translations[lang], not at request root`;
    }
  }
  return null;
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
    userId: album.user_id || undefined,
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

      // Логируем для отладки, если duration отсутствует
      if (duration == null && track.track_id) {
        console.log(
          `[albums.ts] ⚠️ Track ${track.track_id} (${track.title}) has no duration. Raw value:`,
          track.duration
        );
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
        id: normalizeTrackIdString(track.track_id) || String(track.track_id),
        title: track.title,
        order_index:
          typeof track.order_index === 'number' && !Number.isNaN(track.order_index)
            ? track.order_index
            : 0,
        // Убеждаемся, что duration всегда число (0, если отсутствует)
        duration: duration ?? 0,
        src: resolveTrackSrcToSupabasePublicUrl(track.src, album.user_id),
        content: track.content || undefined,
        authorship: track.authorship || undefined,
        syncedLyrics: syncedLyrics || undefined,
      };
    }),
  };
}

function sortAlbumRowsForMerge(rows: AlbumRow[]): AlbumRow[] {
  const rank = (l: string) => (l === 'ru' ? 0 : l === 'en' ? 1 : 2);
  return [...rows].sort(
    (a, b) =>
      rank(a.lang) - rank(b.lang) ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function mergeTrackPayloads(payloads: AlbumData[]): TrackData[] {
  const sorted = [...payloads].sort((a, b) => {
    const rank = (l: string | undefined) => (l === 'ru' ? 0 : l === 'en' ? 1 : 2);
    return rank(a.lang) - rank(b.lang);
  });
  const canonical = sorted[0];
  return canonical.tracks.map((ct) => {
    const translations: Partial<Record<SupportedLang, TrackLocalePayload>> = {};
    for (const p of sorted) {
      if (!p.lang || !validateLang(p.lang)) continue;
      const match = p.tracks.find((t) => t.id === ct.id);
      if (match) {
        translations[p.lang] = {
          title: match.title,
          content: match.content,
          authorship: match.authorship,
          syncedLyrics: match.syncedLyrics,
        };
      }
    }
    return {
      ...ct,
      translations,
    };
  });
}

function mergeAlbumDataPayloads(payloads: AlbumData[]): AlbumData {
  if (payloads.length === 0) {
    throw new Error('mergeAlbumDataPayloads: empty payloads');
  }
  const sorted = [...payloads].sort((a, b) => {
    const rank = (l: string | undefined) => (l === 'ru' ? 0 : l === 'en' ? 1 : 2);
    return rank(a.lang) - rank(b.lang);
  });
  const canonical = sorted[0];
  const translations: Partial<Record<SupportedLang, AlbumLocalePayload>> = {};
  for (const p of sorted) {
    if (p.lang && validateLang(p.lang)) {
      translations[p.lang] = {
        album: p.album,
        fullName: p.fullName,
        description: p.description,
        details: p.details,
      };
    }
  }
  const tracks = mergeTrackPayloads(sorted);
  return {
    userId: canonical.userId,
    albumId: canonical.albumId,
    artist: canonical.artist,
    album: canonical.album,
    fullName: canonical.fullName,
    description: canonical.description,
    cover: canonical.cover,
    release: canonical.release,
    buttons: canonical.buttons,
    details: canonical.details,
    tracks,
    translations,
  };
}

/** Загрузка одной языковой версии альбома (как раньше один ряд albums + треки). */
async function loadAlbumDataFromRow(album: AlbumRow): Promise<AlbumData> {
  const rowLang = album.lang;

  const tracksResult = await query<TrackRow>(
    `SELECT 
                t.track_id,
                t.title,
                t.duration,
                t.src,
                t.content,
                t.authorship,
                t.synced_lyrics,
                t.order_index
              FROM tracks t
              WHERE t.album_id = $1
              ORDER BY t.order_index ASC`,
    [album.id]
  );

  if (album.album_id === '23-remastered') {
    console.log(`[albums.ts GET] 🔍 DEBUG tracks query for 23-remastered:`, {
      albumId: album.album_id,
      albumUUID: album.id,
      lang: album.lang,
      tracksCount: tracksResult.rows.length,
      tracks: tracksResult.rows.map((t) => ({
        trackId: t.track_id,
        title: t.title,
        orderIndex: t.order_index,
      })),
    });

    if (tracksResult.rows.length > 3) {
      console.log(
        `[albums.ts GET] ⚠️ ПРОБЛЕМА: Найдено ${tracksResult.rows.length} треков вместо 3!`
      );
      const allTracksCheck = await query<{
        track_id: string;
        title: string;
        album_uuid: string;
        album_created_at: Date;
      }>(
        `SELECT t.track_id, t.title, a.id as album_uuid, a.created_at as album_created_at
                   FROM tracks t
                   INNER JOIN albums a ON t.album_id = a.id
                   WHERE a.album_id = $1 AND a.lang = $2
                   ORDER BY a.created_at DESC, t.order_index ASC`,
        [album.album_id, album.lang]
      );

      console.log(`[albums.ts GET] Все треки для album_id='23-remastered' (${album.lang}):`, {
        totalTracksInDB: allTracksCheck.rows.length,
        uniqueAlbumUUIDs: Array.from(new Set(allTracksCheck.rows.map((r) => r.album_uuid))),
        currentAlbumUUID: album.id,
        tracksForCurrentAlbum: tracksResult.rows.length,
      });
    }
  }

  console.log(`[albums.ts GET] Tracks loaded for album ${album.album_id} (${album.lang}):`, {
    tracksCount: tracksResult.rows.length,
    tracksWithDuration: tracksResult.rows.filter((t) => t.duration != null).length,
    tracksWithoutDuration: tracksResult.rows.filter((t) => t.duration == null).length,
    sampleTrack: tracksResult.rows[0]
      ? {
          trackId: tracksResult.rows[0].track_id,
          title: tracksResult.rows[0].title,
          duration: tracksResult.rows[0].duration,
          durationType: typeof tracksResult.rows[0].duration,
        }
      : null,
  });

  const trackIds = tracksResult.rows.map((t) => t.track_id);
  let syncedLyricsMap = new Map<string, { synced_lyrics: unknown; authorship: string | null }>();

  if (trackIds.length > 0) {
    try {
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
        [album.album_id, trackIds, rowLang]
      );

      syncedLyricsResult.rows.forEach((r) => {
        syncedLyricsMap.set(r.track_id, {
          synced_lyrics: r.synced_lyrics,
          authorship: r.authorship,
        });
      });
    } catch (syncedError) {
      console.error('❌ [albums.ts GET] Error loading synced lyrics:', syncedError);
    }
  }

  const tracksWithSyncedLyrics = tracksResult.rows.map((track) => {
    const syncedData = syncedLyricsMap.get(track.track_id);
    if (syncedData) {
      return {
        ...track,
        synced_lyrics: syncedData.synced_lyrics,
        authorship: syncedData.authorship || track.authorship,
      };
    }
    return track;
  });

  const mapped = mapAlbumToApiFormat(album, tracksWithSyncedLyrics);
  console.log(`[albums.ts GET] Album ${album.album_id} mapped tracks:`, {
    tracksCount: mapped.tracks.length,
    tracksWithDuration: mapped.tracks.filter((t) => t.duration != null).length,
    tracksWithoutDuration: mapped.tracks.filter((t) => t.duration == null).length,
    sampleTrack: mapped.tracks[0]
      ? {
          id: mapped.tracks[0].id,
          title: mapped.tracks[0].title,
          duration: mapped.tracks[0].duration,
          durationType: typeof mapped.tracks[0].duration,
        }
      : null,
  });

  return mapped;
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
    // GET: загрузка альбомов (все языковые версии сливаются в одну сущность с translations)
    if (event.httpMethod === 'GET') {
      const { artist, resolveOwnerByAlbumId, albumId } = event.queryStringParameters || {};

      // Resolve helper: find artist slug by albumId (used for smart redirect from /albums/:id).
      if (resolveOwnerByAlbumId === 'true') {
        if (!albumId) {
          return createErrorResponse(400, 'albumId is required when resolveOwnerByAlbumId=true');
        }

        const ownerResult = await query<AlbumOwnerSlugRow>(
          `SELECT u.public_slug
           FROM albums a
           INNER JOIN users u ON u.id = a.user_id
           WHERE a.album_id = $1
             AND u.is_active = true
             AND u.public_slug IS NOT NULL
           ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
           LIMIT 1`,
          [albumId]
        );

        if (ownerResult.rows.length === 0) {
          return createErrorResponse(404, 'Album owner slug not found');
        }

        return createSuccessResponse({ artistSlug: ownerResult.rows[0].public_slug });
      }

      const authUserId = getUserIdFromEvent(event);
      let targetUserId: string;

      if (artist) {
        try {
          targetUserId = await resolvePublicArtistUserId(artist);
        } catch (error) {
          if (error instanceof PublicArtistResolverError) {
            return createErrorResponse(error.statusCode, error.message);
          }
          throw error;
        }
      } else if (authUserId) {
        // Приватный режим для админки: если есть JWT и artist не указан, берем владельца токена.
        targetUserId = authUserId;
      } else {
        try {
          targetUserId = await resolvePublicArtistUserId(undefined);
        } catch (error) {
          if (error instanceof PublicArtistResolverError) {
            return createErrorResponse(error.statusCode, error.message);
          }
          throw error;
        }
      }

      // Возвращаем альбомы только выбранного артиста (owner user_id), все lang → merge
      const albumsResult = await query<AlbumRow>(
        `SELECT
             a.id,
             a.user_id,
             a.album_id,
             a.artist,
             a.album,
             a.full_name,
             a.description,
             a.cover,
             a.release,
             a.buttons,
             a.details,
             a.lang,
             a.is_public,
             a.created_at,
             a.updated_at
         FROM albums a
         WHERE a.user_id = $1
         ORDER BY a.album_id,
           CASE a.lang WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END,
           a.updated_at DESC NULLS LAST,
           a.created_at DESC`,
        [targetUserId]
      );

      const byAlbumId = new Map<string, AlbumRow[]>();
      const albumIdsOrdered: string[] = [];
      for (const row of albumsResult.rows) {
        if (!byAlbumId.has(row.album_id)) {
          albumIdsOrdered.push(row.album_id);
          byAlbumId.set(row.album_id, []);
        }
        byAlbumId.get(row.album_id)!.push(row);
      }

      const albumsWithTracks: AlbumData[] = [];
      for (const albumKey of albumIdsOrdered) {
        const group = byAlbumId.get(albumKey)!;
        const sorted = sortAlbumRowsForMerge(group);
        const payloads = await Promise.all(sorted.map((r) => loadAlbumDataFromRow(r)));
        const merged = mergeAlbumDataPayloads(payloads) as IAlbums;
        albumsWithTracks.push(hydrateMissingRuTranslationsOnAlbum(merged));
      }

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

      const forbidden = albumRequestHasForbiddenRootFields(
        data as unknown as Record<string, unknown>
      );
      if (forbidden) {
        return createErrorResponse(400, forbidden);
      }

      const locale = data.translations?.[data.lang];
      const albumTitle = locale?.album?.trim() ?? '';

      console.log('📝 POST /api/albums - Request data:', {
        albumId: data.albumId,
        lang: data.lang,
        hasTranslations: !!data.translations,
        bodyKeys: Object.keys(data),
      });

      if (!data.albumId || !data.lang || !validateLang(data.lang)) {
        console.error('❌ POST /api/albums - Validation failed:', {
          missingFields: {
            albumId: !data.albumId,
            lang: !data.lang || !validateLang(data.lang),
          },
          receivedData: data,
        });
        return createErrorResponse(
          400,
          'Missing required fields: albumId, lang (must be "en" or "ru")'
        );
      }

      if (!albumTitle) {
        return createErrorResponse(
          400,
          'Missing translations[lang].album — localized title is required'
        );
      }

      const albumUserId = userId;

      const albumResult = await query<AlbumRow>(
        `INSERT INTO albums (
          user_id, album_id, artist, album, full_name, description,
          cover, release, buttons, details, lang, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id, album_id, lang)
        DO UPDATE SET
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
          '',
          albumTitle,
          locale?.fullName ?? null,
          locale?.description ?? null,
          data.cover || null,
          JSON.stringify(data.release || {}),
          JSON.stringify(data.buttons || {}),
          JSON.stringify(locale?.details ?? []),
          data.lang,
          false,
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

        const forbiddenPut = albumRequestHasForbiddenRootFields(
          data as unknown as Record<string, unknown>
        );
        if (forbiddenPut) {
          return createErrorResponse(400, forbiddenPut);
        }

        console.log('📝 PUT /api/albums - Request data:', {
          albumId: data.albumId,
          lang: data.lang,
          hasTranslations: data.translations !== undefined,
          hasRelease: data.release !== undefined,
          hasButtons: data.buttons !== undefined,
        });

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

        const localePatch = data.translations?.[data.lang];

        const updateFields: string[] = [];
        const updateValues: unknown[] = [];
        let paramIndex = 1;

        if (localePatch?.album !== undefined) {
          updateFields.push(`album = $${paramIndex++}`);
          updateValues.push(localePatch.album);
        }
        if (localePatch?.fullName !== undefined) {
          updateFields.push(`full_name = $${paramIndex++}`);
          updateValues.push(localePatch.fullName);
        }
        if (localePatch?.description !== undefined) {
          updateFields.push(`description = $${paramIndex++}`);
          updateValues.push(localePatch.description);
        }
        if (localePatch?.details !== undefined) {
          updateFields.push(`details = $${paramIndex++}::jsonb`);
          updateValues.push(JSON.stringify(localePatch.details));
        }
        if (data.cover !== undefined && data.cover !== null && data.cover !== '') {
          updateFields.push(`cover = $${paramIndex++}::text`);
          updateValues.push(data.cover);
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

        if (updateFields.length === 0) {
          return createErrorResponse(400, 'No fields to update.');
        }

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
          // Загружаем треки по конкретному UUID альбома
          // Важно: фильтруем по конкретному альбому (UUID), чтобы не получить треки из других альбомов
          tracksResult = await query<TrackRow>(
            `SELECT 
              t.track_id,
              t.title,
              t.duration,
              t.src,
              t.content,
              t.authorship,
              t.synced_lyrics,
              t.order_index
            FROM tracks t
            WHERE t.album_id = $1
            ORDER BY t.order_index ASC`,
            [updatedAlbum.id]
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
              // Загружаем треки по конкретному UUID альбома
              // Важно: фильтруем по конкретному альбому (UUID), чтобы не получить треки из других альбомов
              const tracksResult = await query<TrackRow>(
                `SELECT 
                  t.track_id,
                  t.title,
                  t.duration,
                  t.src,
                  t.content,
                  t.authorship,
                  t.synced_lyrics,
                  t.order_index
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
            album: album.album,
            fullName: album.fullName,
            description: album.description,
            cover: album.cover,
            release: album.release,
            buttons: album.buttons,
            details: album.details,
            tracks: album.tracks.map((track) => {
              return {
                id: normalizeTrackIdString(track.id),
                title: track.title,
                order_index: track.order_index ?? 0,
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
            'Missing required fields: albumId, lang, trackOrders (ordered array of { trackId }, optional orderIndex ignored)'
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

        const orderedIds = data.trackOrders.map(
          (row) => normalizeTrackIdString(row.trackId) || String(row.trackId)
        );
        if (new Set(orderedIds).size !== orderedIds.length) {
          return createErrorResponse(400, 'Duplicate trackId in trackOrders.');
        }

        const dbTracks = await query<{ track_id: string }>(
          `SELECT track_id FROM tracks WHERE album_id = $1`,
          [album.id]
        );
        const dbSet = new Set(
          dbTracks.rows.map((r) => normalizeTrackIdString(r.track_id) || String(r.track_id))
        );
        if (orderedIds.length !== dbSet.size || !orderedIds.every((id) => dbSet.has(id))) {
          return createErrorResponse(
            400,
            'trackOrders must list every track in the album exactly once (order only; client orderIndex is ignored).'
          );
        }

        const client = await getClient();
        try {
          await client.query('BEGIN');
          await client.query(`SELECT id FROM albums WHERE id = $1 FOR UPDATE`, [album.id]);
          for (let i = 0; i < orderedIds.length; i++) {
            const orderIndex = rankToOrderIndex(i);
            await client.query(
              `UPDATE tracks 
               SET order_index = $1, updated_at = CURRENT_TIMESTAMP
               WHERE album_id = $2 AND track_id = $3`,
              [orderIndex, album.id, orderedIds[i]]
            );
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }

        console.log('✅ PATCH /api/albums - Tracks reordered:', {
          albumId: data.albumId,
          lang: data.lang,
          tracksCount: orderedIds.length,
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
              const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
                  // https://{project}.supabase.co/storage/v1/object/public/user-media/users/{userId}/audio/...
                  const urlMatch = track.src.match(/\/user-media\/(.+)$/);
                  if (urlMatch) {
                    storagePath = urlMatch[1];
                  } else {
                    // Альтернативный формат: путь после /audio/
                    const audioMatch = track.src.match(/\/audio\/(.+)$/);
                    if (audioMatch) {
                      storagePath = `users/${userId}/audio/${audioMatch[1]}`;
                    } else {
                      console.warn('⚠️ Could not extract storage path from src:', track.src);
                      storagePath = '';
                    }
                  }
                } else {
                  // Если это относительный путь, добавляем префикс
                  // Формат: /audio/albumId/fileName или users/{userId}/audio/albumId/fileName
                  if (track.src.startsWith('/audio/')) {
                    storagePath = `users/${userId}${track.src}`;
                  } else if (track.src.startsWith('users/')) {
                    storagePath = track.src;
                  } else {
                    storagePath = `users/${userId}/audio/${track.src}`;
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
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

                const coverPaths = coverVariants.map(
                  (variant) => `users/${userId}/albums/${variant}`
                );
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
