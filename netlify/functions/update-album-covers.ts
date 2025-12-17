/**
 * Netlify Function для обновления имен обложек альбомов в БД
 *
 * Использование:
 *   POST /api/update-album-covers
 *
 * Обновляет все старые имена обложек (Tar-Baby-Cover-*) на новые (smolyanoe-chuchelko-Cover-*)
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
} from './lib/api-helpers';

interface AlbumRow {
  id: string;
  album_id: string;
  cover: Record<string, unknown>;
}

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed. Use POST.');
  }

  try {
    // Проверяем авторизацию
    const userId = requireAuth(event);
    if (!userId) {
      return createErrorResponse(401, 'Unauthorized. Authentication required.');
    }

    console.log('🔄 Начинаем обновление имен обложек альбомов...\n');

    // Загружаем все альбомы
    const albumsResult = await query<AlbumRow>(
      `SELECT id, album_id, cover
       FROM albums
       WHERE cover IS NOT NULL
       ORDER BY album_id, lang`
    );

    console.log(`📋 Найдено альбомов: ${albumsResult.rows.length}`);

    const updates: Array<{ albumId: string; oldName: string; newName: string }> = [];
    let updatedCount = 0;

    // Проверяем каждый альбом
    for (const album of albumsResult.rows) {
      const cover = album.cover as { img?: string } | null;
      if (!cover || !cover.img) {
        continue;
      }

      const oldName = cover.img;

      // Пропускаем, если уже в новом формате
      if (oldName.includes('smolyanoe-chuchelko-Cover')) {
        continue;
      }

      // Определяем новое имя для всех старых вариантов
      let newName: string | null = null;

      // Случай 1: Tar-Baby-Cover-* (любые варианты)
      if (oldName.includes('Tar-Baby-Cover')) {
        newName = oldName.replace(/Tar-Baby-Cover/g, 'smolyanoe-chuchelko-Cover');
      }
      // Случай 2: 23-cover или просто albumId-cover
      else if (
        oldName === '23-cover' ||
        oldName === `${album.album_id}-cover` ||
        oldName.match(/^[0-9]+-cover$/)
      ) {
        newName = `smolyanoe-chuchelko-Cover-${album.album_id}`;
      }
      // Случай 3: Любое имя, содержащее только albumId и "cover" без префикса
      else if (oldName.includes('-cover') && !oldName.includes('Cover')) {
        newName = `smolyanoe-chuchelko-Cover-${album.album_id}`;
      }

      // Обновляем альбом, если определили новое имя
      if (newName) {
        await query(
          `UPDATE albums
           SET cover = jsonb_set(cover, '{img}', $1::jsonb),
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(newName), album.id]
        );

        updates.push({
          albumId: album.album_id,
          oldName,
          newName,
        });

        updatedCount++;
        console.log(`✅ Обновлен альбом ${album.album_id}: "${oldName}" → "${newName}"`);
      } else {
        console.log(`⚠️  Пропущен альбом ${album.album_id}: "${oldName}" (неизвестный формат)`);
      }
    }

    console.log(`\n📊 Итоги: обновлено ${updatedCount} альбомов`);

    return createSuccessResponse(
      {
        success: true,
        message: `Updated ${updatedCount} album covers`,
        updated: updatedCount,
        details: updates,
      },
      200
    );
  } catch (error) {
    console.error('❌ Ошибка обновления имен обложек:', error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
