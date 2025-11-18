/**
 * Netlify Function для миграции данных из JSON в базу данных
 *
 * Использование:
 *   netlify functions:invoke migrate-json-to-db
 *
 * Или через HTTP:
 *   POST /api/migrate-json-to-db
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationResult {
  albumsCreated: number;
  tracksCreated: number;
  errors: string[];
}

interface AlbumData {
  albumId?: string;
  artist: string;
  album: string;
  fullName: string;
  description: string;
  cover: any;
  release: any;
  buttons: any;
  details: any[];
  tracks?: Array<{
    id: number | string;
    title: string;
    duration?: number;
    src?: string;
    content?: string;
    authorship?: string;
    syncedLyrics?: Array<{
      text: string;
      startTime: number;
      endTime?: number;
    }>;
  }>;
}

async function migrateAlbumsToDb(
  albums: AlbumData[],
  lang: 'en' | 'ru',
  userId: string | null = null
): Promise<MigrationResult> {
  const result: MigrationResult = {
    albumsCreated: 0,
    tracksCreated: 0,
    errors: [],
  };

  for (const album of albums) {
    try {
      // Генерируем album_id, если его нет
      const albumId =
        album.albumId || `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

      // 1. Создаём альбом
      const albumResult = await query(
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
        RETURNING id`,
        [
          userId,
          albumId,
          album.artist,
          album.album,
          album.fullName,
          album.description,
          JSON.stringify(album.cover),
          JSON.stringify(album.release),
          JSON.stringify(album.buttons),
          JSON.stringify(album.details),
          lang,
          userId === null, // публичный, если user_id NULL
        ]
      );

      const albumDbId = albumResult.rows[0].id;
      result.albumsCreated++;

      // 2. Создаём треки
      if (album.tracks && album.tracks.length > 0) {
        for (let i = 0; i < album.tracks.length; i++) {
          const track = album.tracks[i];
          try {
            await query(
              `INSERT INTO tracks (
                album_id, track_id, title, duration, src, content,
                authorship, synced_lyrics, order_index
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (album_id, track_id)
              DO UPDATE SET
                title = EXCLUDED.title,
                duration = EXCLUDED.duration,
                src = EXCLUDED.src,
                content = EXCLUDED.content,
                authorship = EXCLUDED.authorship,
                synced_lyrics = EXCLUDED.synced_lyrics,
                order_index = EXCLUDED.order_index,
                updated_at = CURRENT_TIMESTAMP`,
              [
                albumDbId,
                String(track.id),
                track.title,
                track.duration || null,
                track.src || null,
                track.content || null,
                track.authorship || null,
                track.syncedLyrics ? JSON.stringify(track.syncedLyrics) : null,
                i,
              ]
            );
            result.tracksCreated++;
          } catch (error) {
            const errorMsg = `Track ${track.id} in album ${albumId}: ${
              error instanceof Error ? error.message : String(error)
            }`;
            result.errors.push(errorMsg);
            console.error('❌', errorMsg);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Album ${album.albumId || album.album}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      result.errors.push(errorMsg);
      console.error('❌', errorMsg);
    }
  }

  return result;
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Только POST запросы
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
    };
  }

  // TODO: Добавить проверку авторизации для безопасности
  // const authHeader = event.headers.authorization;
  // if (!authHeader || !isValidAdminToken(authHeader)) {
  //   return {
  //     statusCode: 401,
  //     headers,
  //     body: JSON.stringify({ success: false, error: 'Unauthorized' }),
  //   };
  // }

  try {
    console.log('🚀 Начинаем миграцию JSON → БД...');

    // Загружаем JSON файлы из GitHub (как в клиентском коде)
    const BASE_URL = 'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/main/src/assets';

    let albumsRu: AlbumData[];
    let albumsEn: AlbumData[];

    try {
      console.log('📥 Загружаем albums-ru.json из GitHub...');
      const ruResponse = await fetch(`${BASE_URL}/albums-ru.json`);
      if (!ruResponse.ok) {
        throw new Error(`HTTP ${ruResponse.status}: ${ruResponse.statusText}`);
      }
      albumsRu = await ruResponse.json();
      console.log(`✅ Загружено ${albumsRu.length} русских альбомов`);
    } catch (error) {
      console.error('❌ Ошибка загрузки albums-ru.json:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Failed to load albums-ru.json: ${error instanceof Error ? error.message : String(error)}`,
        }),
      };
    }

    try {
      console.log('📥 Загружаем albums-en.json из GitHub...');
      const enResponse = await fetch(`${BASE_URL}/albums-en.json`);
      if (!enResponse.ok) {
        throw new Error(`HTTP ${enResponse.status}: ${enResponse.statusText}`);
      }
      albumsEn = await enResponse.json();
      console.log(`✅ Загружено ${albumsEn.length} английских альбомов`);
    } catch (error) {
      console.error('❌ Ошибка загрузки albums-en.json:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Failed to load albums-en.json: ${error instanceof Error ? error.message : String(error)}`,
        }),
      };
    }

    // Мигрируем русские альбомы (публичные, user_id = NULL)
    console.log('📦 Мигрируем русские альбомы...');
    const ruResult = await migrateAlbumsToDb(albumsRu, 'ru', null);
    console.log('✅ RU:', {
      albums: ruResult.albumsCreated,
      tracks: ruResult.tracksCreated,
      errors: ruResult.errors.length,
    });

    // Мигрируем английские альбомы (публичные, user_id = NULL)
    console.log('📦 Мигрируем английские альбомы...');
    const enResult = await migrateAlbumsToDb(albumsEn, 'en', null);
    console.log('✅ EN:', {
      albums: enResult.albumsCreated,
      tracks: enResult.tracksCreated,
      errors: enResult.errors.length,
    });

    // Выводим ошибки, если есть
    const allErrors = [...ruResult.errors, ...enResult.errors];

    const summary = {
      success: true,
      message: 'Migration completed',
      results: {
        ru: {
          albums: ruResult.albumsCreated,
          tracks: ruResult.tracksCreated,
          errors: ruResult.errors.length,
        },
        en: {
          albums: enResult.albumsCreated,
          tracks: enResult.tracksCreated,
          errors: enResult.errors.length,
        },
        total: {
          albums: ruResult.albumsCreated + enResult.albumsCreated,
          tracks: ruResult.tracksCreated + enResult.tracksCreated,
          errors: allErrors.length,
        },
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
    };

    console.log('🎉 Миграция завершена!', summary);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(summary),
    };
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
