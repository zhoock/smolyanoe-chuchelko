/**
 * Скрипт для выгрузки всех треков с их аудиофайлами из базы данных
 *
 * Использование:
 *   npx tsx scripts/export-all-tracks-with-audio.ts
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

async function exportAllTracksWithAudio() {
  console.log('🔄 Начинаем выгрузку всех треков с аудиофайлами...\n');

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
            dbId: track.id,
            createdAt: track.created_at,
            updatedAt: track.updated_at,
          })),
        };
      }),
    };

    // Сохраняем в JSON файл
    const outputPath = path.resolve(__dirname, '../all-tracks-with-audio.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`✅ Данные сохранены в файл: ${outputPath}\n`);

    // Выводим детальную информацию по каждому альбому
    console.log('📀 Детальная информация по альбомам:\n');
    Object.entries(tracksByAlbum).forEach(([albumKey, tracks]) => {
      const albumInfo = albumsInfo[albumKey];
      console.log(`🎵 ${albumInfo.album_id} (${albumInfo.lang}) - "${albumInfo.album}"`);
      console.log(`   Исполнитель: ${albumInfo.artist}`);
      console.log(`   Треков: ${tracks.length}`);
      console.log(`   Треки:`);
      tracks.forEach((track) => {
        const durationStr =
          track.duration != null
            ? (() => {
                const d = Number(track.duration);
                const mins = Math.floor(d / 60);
                const secs = Math.floor(d % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              })()
            : '--:--';
        console.log(
          `     ${track.order_index + 1}. [${track.track_id}] ${track.title} - ${durationStr}`
        );
        console.log(`        src: ${track.src || '(нет)'}`);
        console.log(`        DB ID: ${track.id}`);
      });
      console.log('');
    });

    // Особое внимание к альбому "Смоляное чучелко"
    const smolyanoechuchelkoAlbums = Object.entries(tracksByAlbum).filter(
      ([albumKey]) => albumsInfo[albumKey].album_id === 'smolyanoechuchelko'
    );

    if (smolyanoechuchelkoAlbums.length > 0) {
      console.log('\n🔍 Детальная информация по альбому "Смоляное чучелко":\n');
      smolyanoechuchelkoAlbums.forEach(([albumKey, tracks]) => {
        const albumInfo = albumsInfo[albumKey];
        console.log(`📀 ${albumInfo.album_id} (${albumInfo.lang}) - "${albumInfo.album}"`);
        console.log(`   Исполнитель: ${albumInfo.artist}`);
        console.log(`   Треков в базе: ${tracks.length}`);
        console.log(`   Треки:`);
        tracks.forEach((track) => {
          const durationStr =
            track.duration != null
              ? (() => {
                  const d = Number(track.duration);
                  const mins = Math.floor(d / 60);
                  const secs = Math.floor(d % 60);
                  return `${mins}:${secs.toString().padStart(2, '0')}`;
                })()
              : '--:--';
          console.log(`     ${track.order_index + 1}. [${track.track_id}] ${track.title}`);
          console.log(`        Duration: ${durationStr} (${track.duration} сек)`);
          console.log(`        src: ${track.src || '(нет)'}`);
          console.log(`        DB ID: ${track.id}`);
          console.log(`        Created: ${track.created_at}`);
          console.log(`        Updated: ${track.updated_at}`);
        });
        console.log('');
      });
    }

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
  exportAllTracksWithAudio()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { exportAllTracksWithAudio };
