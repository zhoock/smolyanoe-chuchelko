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

interface AlbumRow {
  id: string;
  user_id: string | null;
  album_id: string;
  artist: string;
  album: string;
  full_name: string;
  description: string;
  cover: any;
  release: any;
  buttons: any;
  details: any;
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
  synced_lyrics: any | null;
  order_index: number;
}

interface AlbumsResponse {
  success: boolean;
  data?: Array<{
    albumId: string;
    artist: string;
    album: string;
    fullName: string;
    description: string;
    cover: any;
    release: any;
    buttons: any;
    details: any;
    lang: string;
    tracks: Array<{
      id: string;
      title: string;
      duration?: number;
      src?: string;
      content?: string;
      authorship?: string;
      syncedLyrics?: any;
    }>;
  }>;
  error?: string;
  message?: string;
}

import { extractUserIdFromToken } from './lib/jwt';

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET: загрузка альбомов
    if (event.httpMethod === 'GET') {
      const { lang } = event.queryStringParameters || {};

      if (!lang || !['en', 'ru'].includes(lang)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid lang parameter. Must be "en" or "ru".',
          } as AlbumsResponse),
        };
      }

      // Извлекаем user_id из токена (если есть)
      const userId = extractUserIdFromToken(event.headers.authorization);

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

          return {
            albumId: album.album_id,
            artist: album.artist,
            album: album.album,
            fullName: album.full_name,
            description: album.description,
            cover: album.cover,
            release: album.release,
            buttons: album.buttons,
            details: album.details,
            lang: album.lang,
            tracks: tracksResult.rows.map((track) => ({
              id: track.track_id,
              title: track.title,
              duration: track.duration || undefined,
              src: track.src || undefined,
              content: track.content || undefined,
              authorship: track.authorship || undefined,
              syncedLyrics: track.synced_lyrics || undefined,
            })),
          };
        })
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: albumsWithTracks,
        } as AlbumsResponse),
      };
    }

    // POST: создание альбома (требует авторизации)
    if (event.httpMethod === 'POST') {
      const userId = extractUserIdFromToken(event.headers.authorization);

      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Unauthorized. Authentication required.',
          } as AlbumsResponse),
        };
      }

      const data = JSON.parse(event.body || '{}');

      // Валидация данных
      if (!data.albumId || !data.artist || !data.album || !data.lang) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: albumId, artist, album, lang',
          } as AlbumsResponse),
        };
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Album created successfully',
          data: [
            {
              albumId: albumResult.rows[0].album_id,
              artist: albumResult.rows[0].artist,
              album: albumResult.rows[0].album,
              fullName: albumResult.rows[0].full_name,
              description: albumResult.rows[0].description,
              cover: albumResult.rows[0].cover,
              release: albumResult.rows[0].release,
              buttons: albumResult.rows[0].buttons,
              details: albumResult.rows[0].details,
              lang: albumResult.rows[0].lang,
              tracks: [],
            },
          ],
        } as AlbumsResponse),
      };
    }

    // Неподдерживаемый метод
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use GET or POST.',
      } as AlbumsResponse),
    };
  } catch (error) {
    console.error('❌ Error in albums function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as AlbumsResponse),
    };
  }
};
