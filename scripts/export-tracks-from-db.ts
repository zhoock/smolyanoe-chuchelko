/**
 * Скрипт для выгрузки всех треков из базы данных
 *
 * Использование:
 *   npx tsx scripts/export-tracks-from-db.ts
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
  album_id: string;
  track_id: string;
  title: string;
  duration: number | string | null;
  src: string | null;
  content: string | null;
  authorship: string | null;
  order_index: number;
  created_at: Date;
  updated_at: Date;
}

interface AlbumInfo {
  album_id: string;
  artist: string;
  album: string;
  lang: string;
  user_id: string | null;
}

interface TrackWithAlbum extends TrackRow {
  album_info: AlbumInfo;
}

async function exportTracksFromDb() {
  console.log('🔄 Начинаем выгрузку треков из базы данных...\n');

  try {
    // Получаем все треки с информацией об альбомах
    const tracksResult = await query<TrackWithAlbum>(
      `SELECT 
        t.id,
        t.album_id,
        t.track_id,
        t.title,
        t.duration,
        t.src,
        t.content,
        t.authorship,
        t.order_index,
        t.created_at,
        t.updated_at,
        a.album_id as album_album_id,
        a.artist,
        a.album,
        a.lang,
        a.user_id
      FROM tracks t
      INNER JOIN albums a ON t.album_id = a.id
      ORDER BY a.album_id, a.lang, t.order_index ASC`
    );

    if (tracksResult.rows.length === 0) {
      console.log('ℹ️  Треки не найдены в базе данных');
      return;
    }

    console.log(`📦 Найдено ${tracksResult.rows.length} треков\n`);

    // Группируем треки по альбомам
    const tracksByAlbum: Record<string, TrackWithAlbum[]> = {};
    const albumsInfo: Record<string, AlbumInfo> = {};

    for (const track of tracksResult.rows) {
      const albumKey = `${track.album_album_id}_${track.lang}`;

      if (!tracksByAlbum[albumKey]) {
        tracksByAlbum[albumKey] = [];
        albumsInfo[albumKey] = {
          album_id: track.album_album_id,
          artist: track.artist,
          album: track.album,
          lang: track.lang,
          user_id: track.user_id,
        };
      }

      tracksByAlbum[albumKey].push({
        ...track,
        album_info: albumsInfo[albumKey],
      });
    }

    // Формируем структуру для вывода
    const output = {
      totalTracks: tracksResult.rows.length,
      totalAlbums: Object.keys(tracksByAlbum).length,
      exportedAt: new Date().toISOString(),
      albums: Object.entries(tracksByAlbum).map(([albumKey, tracks]) => {
        const albumInfo = albumsInfo[albumKey];
        return {
          albumId: albumInfo.album_id,
          artist: albumInfo.artist,
          album: albumInfo.album,
          lang: albumInfo.lang,
          userId: albumInfo.user_id,
          tracksCount: tracks.length,
          tracks: tracks.map((track) => ({
            id: track.track_id,
            title: track.title,
            duration: track.duration != null ? Number(track.duration) : null,
            durationFormatted:
              track.duration != null
                ? (() => {
                    const d = Number(track.duration);
                    const mins = Math.floor(d / 60);
                    const secs = Math.floor(d % 60);
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                  })()
                : null,
            src: track.src,
            hasContent: !!track.content,
            hasAuthorship: !!track.authorship,
            orderIndex: track.order_index,
            createdAt: track.created_at,
            updatedAt: track.updated_at,
          })),
        };
      }),
    };

    // Сохраняем в JSON файл
    const outputPath = path.resolve(__dirname, '../tracks-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`✅ Данные сохранены в файл: ${outputPath}\n`);

    // Выводим статистику
    console.log('📊 Статистика:');
    console.log(`   Всего треков: ${output.totalTracks}`);
    console.log(`   Всего альбомов: ${output.totalAlbums}`);

    // Статистика по duration
    const durations = tracksResult.rows
      .map((t) => (t.duration != null ? Number(t.duration) : null))
      .filter((d): d is number => d !== null);

    if (durations.length > 0) {
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const smallDurations = durations.filter((d) => d < 10).length;

      console.log(`   Duration:`);
      console.log(
        `     Минимальная: ${minDuration.toFixed(2)} сек (${Math.floor(minDuration / 60)}:${Math.floor(
          minDuration % 60
        )
          .toString()
          .padStart(2, '0')})`
      );
      console.log(
        `     Максимальная: ${maxDuration.toFixed(2)} сек (${Math.floor(maxDuration / 60)}:${Math.floor(
          maxDuration % 60
        )
          .toString()
          .padStart(2, '0')})`
      );
      console.log(
        `     Средняя: ${avgDuration.toFixed(2)} сек (${Math.floor(avgDuration / 60)}:${Math.floor(
          avgDuration % 60
        )
          .toString()
          .padStart(2, '0')})`
      );
      console.log(`     Треков с duration < 10 сек: ${smallDurations}`);
    }

    // Выводим список альбомов
    console.log('\n📀 Альбомы:');
    Object.entries(tracksByAlbum).forEach(([albumKey, tracks]) => {
      const albumInfo = albumsInfo[albumKey];
      console.log(`   ${albumInfo.album_id} (${albumInfo.lang}): ${tracks.length} треков`);
    });

    console.log('\n✨ Выгрузка завершена!');
  } catch (error) {
    console.error('❌ Критическая ошибка при выгрузке:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем выгрузку
if (require.main === module) {
  exportTracksFromDb()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { exportTracksFromDb };
