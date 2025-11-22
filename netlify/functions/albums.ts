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

interface AlbumRow {
  id: string;
  user_id: string | null;
  album_id: string;
  artist: string;
  album: string;
  full_name: string;
  description: string;
  cover: Record<string, unknown>;
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
  cover: Record<string, unknown>;
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
  cover?: Record<string, unknown>;
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
    cover: album.cover as Record<string, unknown>,
    release: album.release as Record<string, unknown>,
    buttons: album.buttons as Record<string, unknown>,
    details: album.details as unknown[],
    lang: album.lang,
    tracks: tracks.map((track) => ({
      id: track.track_id,
      title: track.title,
      duration: track.duration || undefined,
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

      return createSuccessResponse(albumsWithTracks);
    }

    // POST: создание альбома (требует авторизации)
    if (event.httpMethod === 'POST') {
      const userId = requireAuth(event);

      if (!userId) {
        return createErrorResponse(401, 'Unauthorized. Authentication required.');
      }

      const data = parseJsonBody<CreateAlbumRequest>(event.body, {} as CreateAlbumRequest);

      // Валидация данных
      if (!data.albumId || !data.artist || !data.album || !data.lang || !validateLang(data.lang)) {
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
          JSON.stringify(data.cover || {}),
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

    // Неподдерживаемый метод
    return createErrorResponse(405, 'Method not allowed. Use GET or POST.');
  } catch (error) {
    return handleError(error, 'albums function');
  }
};
