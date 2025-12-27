/**
 * Скрипт для пересчёта duration всех треков из их аудиофайлов
 *
 * Использование:
 *   npx tsx scripts/recalculate-track-durations.ts
 *
 * Требования:
 *   npm install music-metadata
 */

import { query, closePool } from '../netlify/functions/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { parseFile } from 'music-metadata';
import { createSupabaseAdminClient, STORAGE_BUCKET_NAME } from '../src/config/supabase';

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
  order_index: number;
}

/**
 * Получает полный URL или путь к аудиофайлу
 */
function getAudioFileUrl(src: string): string | null {
  if (!src) return null;

  // Если это уже полный URL, возвращаем как есть
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }

  // Убираем префикс /audio/ если он есть
  const normalizedPath = src.startsWith('/audio/') ? src.slice(7) : src;

  // Сначала пробуем найти локальный файл
  const localPath = path.resolve(__dirname, '../src/audio', normalizedPath);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  // Если локального файла нет, пробуем получить URL из Supabase Storage
  // Формируем путь в Supabase Storage
  // Формат: users/zhoock/audio/{albumId}/{fileName}
  // normalizedPath может быть "23/01-Barnums-Fijian-Mermaid-1644.wav"
  const userId = process.env.CURRENT_USER_ID || 'zhoock';
  const storagePath = `users/${userId}/audio/${normalizedPath}`;

  // Создаём Supabase клиент
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    // Если Supabase не настроен, возвращаем null
    // Но можем попробовать использовать базовый URL из переменных окружения
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    if (supabaseUrl) {
      // Формируем публичный URL напрямую
      // Формат: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
      return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${storagePath}`;
    }
    return null;
  }

  // Получаем публичный URL
  const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/**
 * Получает длительность аудиофайла из URL или локального пути
 */
async function getAudioDurationFromUrl(urlOrPath: string): Promise<number | null> {
  try {
    let filePath: string;

    // Если это локальный путь
    if (fs.existsSync(urlOrPath)) {
      filePath = urlOrPath;
    } else if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      // Если это URL, скачиваем файл во временный файл
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Определяем расширение файла из URL
      let extension = '.mp3';
      try {
        const urlPath = new URL(urlOrPath).pathname;
        extension = path.extname(urlPath) || '.mp3';
      } catch {
        // Если не удалось распарсить URL, используем .mp3 по умолчанию
      }

      const tempFile = path.join(
        tempDir,
        `temp_${Date.now()}_${Math.random().toString(36).substring(7)}${extension}`
      );

      try {
        // Скачиваем файл
        const fileResponse = await fetch(urlOrPath);
        if (!fileResponse.ok) {
          console.warn(
            `⚠️  Failed to download file ${urlOrPath}: ${fileResponse.status} ${fileResponse.statusText}`
          );
          return null;
        }

        const buffer = await fileResponse.arrayBuffer();
        fs.writeFileSync(tempFile, Buffer.from(buffer));
        filePath = tempFile;
      } catch (error) {
        console.error(`❌ Error downloading file ${urlOrPath}:`, error);
        return null;
      }
    } else {
      console.warn(`⚠️  File not found: ${urlOrPath}`);
      return null;
    }

    try {
      // Парсим метаданные
      const metadata = await parseFile(filePath);
      const duration = metadata.format.duration;

      // Удаляем временный файл, если это был скачанный файл
      if (filePath !== urlOrPath && filePath.includes('temp')) {
        fs.unlinkSync(filePath);
      }

      if (duration && Number.isFinite(duration) && duration > 0) {
        return duration;
      }

      return null;
    } catch (error) {
      // Удаляем временный файл в случае ошибки
      if (filePath !== urlOrPath && filePath.includes('temp') && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error getting duration for ${urlOrPath}:`, error);
    return null;
  }
}

async function recalculateTrackDurations() {
  console.log('🔄 Начинаем пересчёт duration для треков с пустым duration...\n');

  try {
    // Получаем только треки с пустым duration (null или 0)
    // В PostgreSQL DECIMAL может быть NULL или число (не может быть пустой строки)
    const tracksResult = await query<TrackRow>(
      `SELECT 
        t.id,
        t.album_id,
        t.track_id,
        t.title,
        t.duration,
        t.src,
        t.order_index
      FROM tracks t
      INNER JOIN albums a ON t.album_id = a.id
      WHERE t.src IS NOT NULL 
        AND t.src != ''
        AND (
          t.duration IS NULL 
          OR t.duration = 0
        )
      ORDER BY a.album_id, a.lang, t.order_index ASC`
    );

    if (tracksResult.rows.length === 0) {
      console.log('ℹ️  Треки не найдены в базе данных');
      return;
    }

    console.log(`📦 Найдено ${tracksResult.rows.length} треков для обработки\n`);

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < tracksResult.rows.length; i++) {
      const track = tracksResult.rows[i];
      const progress = `[${i + 1}/${tracksResult.rows.length}]`;

      console.log(`${progress} Обрабатываем трек: ${track.title} (${track.track_id})`);

      if (!track.src) {
        console.warn(`  ⚠️  Пропускаем: нет src`);
        failed++;
        continue;
      }

      try {
        // Получаем полный URL аудиофайла
        const audioUrl = getAudioFileUrl(track.src);
        if (!audioUrl) {
          console.warn(`  ⚠️  Не удалось получить URL для ${track.src}`);
          failed++;
          errors.push(`Track ${track.track_id}: Failed to get URL for ${track.src}`);
          continue;
        }

        console.log(`  🔗 URL: ${audioUrl}`);

        // Получаем длительность из аудиофайла
        const newDuration = await getAudioDurationFromUrl(audioUrl);

        if (newDuration === null) {
          console.warn(`  ⚠️  Не удалось получить duration`);
          failed++;
          errors.push(`Track ${track.track_id}: Failed to get duration from ${audioUrl}`);
          continue;
        }

        const oldDuration = track.duration != null ? Number(track.duration) : null;
        const formattedNew = `${Math.floor(newDuration / 60)}:${Math.floor(newDuration % 60)
          .toString()
          .padStart(2, '0')}`;
        const formattedOld =
          oldDuration != null
            ? `${Math.floor(oldDuration / 60)}:${Math.floor(oldDuration % 60)
                .toString()
                .padStart(2, '0')}`
            : 'null';

        console.log(
          `  📊 Duration: ${formattedOld} -> ${formattedNew} (${newDuration.toFixed(2)} сек)`
        );

        // Обновляем duration в базе данных
        await query(
          `UPDATE tracks SET duration = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newDuration, track.id]
        );

        updated++;
        console.log(`  ✅ Обновлено\n`);
      } catch (error) {
        console.error(`  ❌ Ошибка:`, error);
        failed++;
        errors.push(
          `Track ${track.track_id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Небольшая задержка между запросами, чтобы не перегружать сервер
      if (i < tracksResult.rows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Удаляем временную директорию
    const tempDir = path.join(__dirname, '../temp');
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach((file) => {
        try {
          fs.unlinkSync(path.join(tempDir, file));
        } catch (error) {
          // Игнорируем ошибки удаления
        }
      });
      try {
        fs.rmdirSync(tempDir);
      } catch (error) {
        // Игнорируем ошибки удаления
      }
    }

    console.log('\n✨ Пересчёт завершён!');
    console.log(`✅ Обновлено: ${updated}`);
    console.log(`❌ Ошибок: ${failed}`);

    if (errors.length > 0) {
      console.log('\n📋 Ошибки:');
      errors.forEach((error) => console.log(`  - ${error}`));
    }
  } catch (error) {
    console.error('❌ Критическая ошибка при пересчёте:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем пересчёт
if (require.main === module) {
  recalculateTrackDurations()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { recalculateTrackDurations };
