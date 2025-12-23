/**
 * Скрипт для исправления user_id для альбома "Смоляное чучелко"
 * Устанавливает user_id для альбома и всех его треков
 *
 * Использование:
 *   npx tsx scripts/fix-smolyanoechuchelko-user-id.ts
 */

import { query, closePool } from '../netlify/functions/lib/db';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем переменные окружения из .env файла
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

async function fixSmolyanoechuchelkoUserId() {
  console.log('🔄 Исправляем user_id для альбома "Смоляное чучелко"...\n');

  try {
    // Находим пользователя zhoock@zhoock.ru
    const userResult = await query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1`,
      ['zhoock@zhoock.ru']
    );

    if (userResult.rows.length === 0) {
      console.error('❌ Пользователь zhoock@zhoock.ru не найден в базе данных');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ Найден пользователь: ${userResult.rows[0].email} (ID: ${userId})\n`);

    // Находим альбомы "Смоляное чучелко" с user_id = null
    const albumsResult = await query<{
      id: string;
      album_id: string;
      lang: string;
      user_id: string | null;
    }>(
      `SELECT id, album_id, lang, user_id 
       FROM albums 
       WHERE album_id = 'smolyanoechuchelko' AND user_id IS NULL`
    );

    if (albumsResult.rows.length === 0) {
      console.log('ℹ️  Альбомы "Смоляное чучелко" с user_id = null не найдены');
      console.log('   Проверяем все альбомы "Смоляное чучелко"...\n');

      const allAlbumsResult = await query<{
        id: string;
        album_id: string;
        lang: string;
        user_id: string | null;
      }>(
        `SELECT id, album_id, lang, user_id 
         FROM albums 
         WHERE album_id = 'smolyanoechuchelko'`
      );

      if (allAlbumsResult.rows.length === 0) {
        console.log('❌ Альбомы "Смоляное чучелко" не найдены в базе данных');
        return;
      }

      console.log(`📦 Найдено ${allAlbumsResult.rows.length} альбомов:`);
      allAlbumsResult.rows.forEach((album) => {
        console.log(`   - ${album.album_id} (${album.lang}): user_id = ${album.user_id || 'NULL'}`);
      });
      console.log('');
    } else {
      console.log(`📦 Найдено ${albumsResult.rows.length} альбомов с user_id = null`);

      // Проверяем, есть ли уже альбомы с правильным user_id
      const existingAlbumsResult = await query<{
        id: string;
        album_id: string;
        lang: string;
        user_id: string;
      }>(
        `SELECT id, album_id, lang, user_id 
         FROM albums 
         WHERE album_id = 'smolyanoechuchelko' AND user_id = $1`,
        [userId]
      );

      console.log(`📦 Найдено ${existingAlbumsResult.rows.length} альбомов с правильным user_id:`);
      existingAlbumsResult.rows.forEach((album) => {
        console.log(`   - ${album.album_id} (${album.lang})`);
      });
      console.log('');

      // Если есть альбомы с правильным user_id, удаляем дубликаты с user_id = null
      if (existingAlbumsResult.rows.length > 0) {
        console.log('🗑️  Удаляем дубликаты альбомов с user_id = null...');

        // Сначала удаляем треки, связанные с этими альбомами
        for (const album of albumsResult.rows) {
          const tracksDeleteResult = await query(`DELETE FROM tracks WHERE album_id = $1`, [
            album.id,
          ]);
          console.log(
            `   Удалено треков из альбома ${album.album_id} (${album.lang}): ${tracksDeleteResult.rowCount || 0}`
          );
        }

        // Затем удаляем сами альбомы
        for (const album of albumsResult.rows) {
          await query(`DELETE FROM albums WHERE id = $1`, [album.id]);
          console.log(`✅ Удалён дубликат альбома ${album.album_id} (${album.lang})`);
        }
        console.log('');
      } else {
        // Если нет альбомов с правильным user_id, обновляем существующие
        console.log('🔄 Обновляем user_id для альбомов...');
        for (const album of albumsResult.rows) {
          await query(
            `UPDATE albums SET user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [userId, album.id]
          );
          console.log(`✅ Обновлён альбом ${album.album_id} (${album.lang})`);
        }
        console.log('');
      }
    }

    // Находим все треки альбомов "Смоляное чучелко" и проверяем их альбомы
    const tracksResult = await query<{
      track_id: string;
      album_id: string;
      album_album_id: string;
      album_lang: string;
      album_user_id: string | null;
    }>(
      `SELECT 
        t.track_id,
        t.album_id,
        a.album_id as album_album_id,
        a.lang as album_lang,
        a.user_id as album_user_id
      FROM tracks t
      INNER JOIN albums a ON t.album_id = a.id
      WHERE a.album_id = 'smolyanoechuchelko'`
    );

    if (tracksResult.rows.length > 0) {
      console.log(`📦 Найдено ${tracksResult.rows.length} треков в альбоме "Смоляное чучелко"`);

      // Группируем треки по альбомам
      const tracksByAlbum = new Map<string, typeof tracksResult.rows>();
      tracksResult.rows.forEach((track) => {
        const key = `${track.album_album_id}_${track.album_lang}`;
        if (!tracksByAlbum.has(key)) {
          tracksByAlbum.set(key, []);
        }
        tracksByAlbum.get(key)!.push(track);
      });

      console.log(`\n📀 Треки по альбомам:`);
      tracksByAlbum.forEach((tracks, key) => {
        const album = tracks[0];
        console.log(
          `   ${key}: ${tracks.length} треков, user_id = ${album.album_user_id || 'NULL'}`
        );
      });
      console.log('');
    }

    console.log('✨ Исправление завершено!');
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем исправление
if (require.main === module) {
  fixSmolyanoechuchelkoUserId()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { fixSmolyanoechuchelkoUserId };
