/**
 * Netlify Function для проверки имен обложек альбомов в БД
 *
 * Использование:
 *   GET /api/check-album-covers
 *
 * Показывает все имена обложек в БД для диагностики
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
} from './lib/api-helpers';

interface AlbumRow {
  id: string;
  album_id: string;
  artist: string;
  album: string;
  cover: Record<string, unknown>;
  lang: string;
}

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return createErrorResponse(405, 'Method not allowed. Use GET.');
  }

  try {
    console.log('🔍 Проверяем имена обложек альбомов в БД...\n');

    // Загружаем все альбомы
    const albumsResult = await query<AlbumRow>(
      `SELECT id, album_id, artist, album, cover, lang
       FROM albums
       WHERE cover IS NOT NULL
       ORDER BY album_id, lang`
    );

    const covers = albumsResult.rows.map((album) => {
      const cover = album.cover as { img?: string } | null;
      return {
        albumId: album.album_id,
        artist: album.artist,
        album: album.album,
        lang: album.lang,
        coverImg: cover?.img || null,
        needsUpdate:
          cover?.img &&
          (cover.img.includes('Tar-Baby-Cover') ||
            cover.img.includes('23-cover') ||
            (!cover.img.includes('smolyanoe-chuchelko-Cover') && cover.img.includes('cover'))),
      };
    });

    const needsUpdate = covers.filter((c) => c.needsUpdate);
    const alreadyUpdated = covers.filter((c) => !c.needsUpdate && c.coverImg);

    console.log(`📊 Всего альбомов: ${covers.length}`);
    console.log(`✅ Уже обновлено: ${alreadyUpdated.length}`);
    console.log(`⚠️  Требуют обновления: ${needsUpdate.length}`);

    if (needsUpdate.length > 0) {
      console.log('\n📋 Альбомы, требующие обновления:');
      needsUpdate.forEach((c) => {
        console.log(`  - ${c.albumId} (${c.lang}): "${c.coverImg}"`);
      });
    }

    return createSuccessResponse(
      {
        success: true,
        total: covers.length,
        updated: alreadyUpdated.length,
        needsUpdate: needsUpdate.length,
        covers,
        needsUpdateList: needsUpdate,
      },
      200
    );
  } catch (error) {
    console.error('❌ Ошибка проверки имен обложек:', error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
