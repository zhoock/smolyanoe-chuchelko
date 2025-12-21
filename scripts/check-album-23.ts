/**
 * Скрипт для проверки наличия альбома "23" в базе данных
 */

import { query } from '../netlify/functions/lib/db';

async function checkAlbum23() {
  try {
    console.log('🔍 Проверяем наличие альбома "23" в базе данных...\n');

    // Проверяем русскую версию
    const ruResult = await query(
      `SELECT album_id, artist, album, lang, is_public, created_at, updated_at 
       FROM albums 
       WHERE album_id = '23' AND lang = 'ru' AND user_id IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (ruResult.rows.length > 0) {
      const album = ruResult.rows[0];
      console.log('✅ Альбом "23" (RU) найден:');
      console.log(`   - Artist: ${album.artist}`);
      console.log(`   - Album: ${album.album}`);
      console.log(`   - Lang: ${album.lang}`);
      console.log(`   - Public: ${album.is_public}`);
      console.log(`   - Updated: ${album.updated_at}\n`);

      // Проверяем треки
      const tracksResult = await query(
        `SELECT COUNT(*) as count FROM tracks t
         INNER JOIN albums a ON t.album_id = a.id
         WHERE a.album_id = '23' AND a.lang = 'ru' AND a.user_id IS NULL`
      );
      console.log(`   - Треков: ${tracksResult.rows[0].count}`);
    } else {
      console.log('❌ Альбом "23" (RU) не найден в базе данных\n');
    }

    // Проверяем английскую версию
    const enResult = await query(
      `SELECT album_id, artist, album, lang, is_public, created_at, updated_at 
       FROM albums 
       WHERE album_id = '23' AND lang = 'en' AND user_id IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (enResult.rows.length > 0) {
      const album = enResult.rows[0];
      console.log('✅ Альбом "23" (EN) найден:');
      console.log(`   - Artist: ${album.artist}`);
      console.log(`   - Album: ${album.album}`);
      console.log(`   - Lang: ${album.lang}`);
      console.log(`   - Public: ${album.is_public}`);
      console.log(`   - Updated: ${album.updated_at}\n`);

      // Проверяем треки
      const tracksResult = await query(
        `SELECT COUNT(*) as count FROM tracks t
         INNER JOIN albums a ON t.album_id = a.id
         WHERE a.album_id = '23' AND a.lang = 'en' AND a.user_id IS NULL`
      );
      console.log(`   - Треков: ${tracksResult.rows[0].count}`);
    } else {
      console.log('❌ Альбом "23" (EN) не найден в базе данных\n');
    }

    // Проверяем все альбомы с album_id содержащим "23"
    const all23Result = await query(
      `SELECT album_id, artist, album, lang, is_public 
       FROM albums 
       WHERE album_id LIKE '%23%' AND user_id IS NULL
       ORDER BY album_id, lang`
    );

    console.log(`\n📊 Всего альбомов с "23" в названии: ${all23Result.rows.length}`);
    all23Result.rows.forEach((album) => {
      console.log(`   - ${album.album_id} (${album.lang}): ${album.artist} — ${album.album}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при проверке:', error);
    process.exit(1);
  }
}

checkAlbum23();
