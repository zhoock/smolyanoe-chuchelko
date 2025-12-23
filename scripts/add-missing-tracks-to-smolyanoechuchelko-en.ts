/**
 * Скрипт для добавления недостающих треков в английскую версию альбома "Смоляное чучелко"
 *
 * Использование:
 *   npx tsx scripts/add-missing-tracks-to-smolyanoechuchelko-en.ts
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

interface TrackRow {
  id: string;
  track_id: string;
  title: string;
  duration: number | null;
  src: string;
  content: string | null;
  authorship: string | null;
  order_index: number;
}

async function addMissingTracks() {
  console.log('🔄 Добавляем недостающие треки в английскую версию альбома "Смоляное чучелко"...\n');

  try {
    // Находим пользователя
    const userResult = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
      'zhoock@zhoock.ru',
    ]);

    if (userResult.rows.length === 0) {
      console.error('❌ Пользователь zhoock@zhoock.ru не найден');
      return;
    }

    const userId = userResult.rows[0].id;

    // Находим альбомы
    const albumsResult = await query<{ id: string; album_id: string; lang: string }>(
      `SELECT id, album_id, lang 
       FROM albums 
       WHERE album_id = 'smolyanoechuchelko' AND user_id = $1`,
      [userId]
    );

    const albumEn = albumsResult.rows.find((a) => a.lang === 'en');
    const albumRu = albumsResult.rows.find((a) => a.lang === 'ru');

    if (!albumEn || !albumRu) {
      console.error('❌ Не найдены альбомы smolyanoechuchelko (en) или (ru)');
      return;
    }

    console.log(`✅ Найдены альбомы:`);
    console.log(`   - ${albumEn.album_id} (${albumEn.lang}): ${albumEn.id}`);
    console.log(`   - ${albumRu.album_id} (${albumRu.lang}): ${albumRu.id}\n`);

    // Получаем все треки из русской версии
    const ruTracksResult = await query<TrackRow>(
      `SELECT id, track_id, title, duration, src, content, authorship, order_index
       FROM tracks
       WHERE album_id = $1
       ORDER BY order_index ASC`,
      [albumRu.id]
    );

    console.log(`📦 Найдено ${ruTracksResult.rows.length} треков в русской версии\n`);

    // Получаем существующие треки из английской версии
    const enTracksResult = await query<TrackRow>(
      `SELECT track_id, order_index
       FROM tracks
       WHERE album_id = $1`,
      [albumEn.id]
    );

    const existingTrackIds = new Set(enTracksResult.rows.map((t) => t.track_id));
    const existingOrderIndexes = new Set(enTracksResult.rows.map((t) => t.order_index));

    console.log(
      `📦 Существующие треки в английской версии: ${Array.from(existingTrackIds).join(', ')}`
    );
    console.log(
      `📦 Существующие order_index: ${Array.from(existingOrderIndexes)
        .sort((a, b) => a - b)
        .join(', ')}\n`
    );

    // Находим недостающие треки
    const missingTracks = ruTracksResult.rows.filter(
      (track) => !existingTrackIds.has(track.track_id)
    );

    if (missingTracks.length === 0) {
      console.log('✅ Все треки уже присутствуют в английской версии');
      return;
    }

    console.log(`📦 Найдено ${missingTracks.length} недостающих треков:`);
    missingTracks.forEach((track) => {
      console.log(`   - [${track.track_id}] ${track.title} (order_index: ${track.order_index})`);
    });
    console.log('');

    // Добавляем недостающие треки
    for (const ruTrack of missingTracks) {
      await query(
        `INSERT INTO tracks (album_id, track_id, title, duration, src, content, authorship, order_index, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          albumEn.id,
          ruTrack.track_id,
          ruTrack.title,
          ruTrack.duration,
          ruTrack.src,
          ruTrack.content,
          ruTrack.authorship,
          ruTrack.order_index,
        ]
      );
      console.log(`✅ Добавлен трек [${ruTrack.track_id}] ${ruTrack.title}`);
    }

    console.log('\n✨ Добавление завершено!');
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем добавление
if (require.main === module) {
  addMissingTracks()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { addMissingTracks };
