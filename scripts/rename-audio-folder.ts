/**
 * Скрипт для переименования папки с аудиофайлами и обновления путей в базе данных
 * Переименовывает Smolyanoe-chuchelko -> smolyanoechuchelko
 *
 * Использование:
 *   npx tsx scripts/rename-audio-folder.ts
 */

import { query, closePool } from '../netlify/functions/lib/db';
import { createClient } from '@supabase/supabase-js';
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

// Также проверяем .env.local
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
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

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Supabase credentials not found');
    console.error(
      '   Please set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_SERVICE_ROLE_KEY)'
    );
    return null;
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('❌ Failed to create Supabase admin client:', error);
    return null;
  }
}

interface TrackRow {
  id: string;
  track_id: string;
  title: string;
  src: string;
}

async function renameAudioFolder() {
  console.log('🔄 Переименовываем папку с аудиофайлами...\n');

  const OLD_FOLDER_NAME = 'Smolyanoe-chuchelko';
  const NEW_FOLDER_NAME = 'smolyanoechuchelko';
  const STORAGE_PATH = `users/zhoock/audio`;

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

    // Находим все треки с старым путём
    const tracksResult = await query<TrackRow>(
      `SELECT t.id, t.track_id, t.title, t.src
       FROM tracks t
       INNER JOIN albums a ON t.album_id = a.id
       WHERE a.album_id = 'smolyanoechuchelko' 
         AND a.user_id = $1
         AND t.src LIKE '/audio/${OLD_FOLDER_NAME}/%'`,
      [userId]
    );

    if (tracksResult.rows.length === 0) {
      console.log('ℹ️  Треки со старым путём не найдены');
      return;
    }

    console.log(`📦 Найдено ${tracksResult.rows.length} треков со старым путём\n`);

    // Создаём Supabase клиент
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      console.error('❌ Не удалось создать Supabase клиент');
      return;
    }

    // 1. Переименовываем файлы в Supabase Storage
    console.log('📁 Переименовываем файлы в Supabase Storage...\n');

    const filesToRename: Array<{ oldPath: string; newPath: string; trackId: string }> = [];

    for (const track of tracksResult.rows) {
      // Извлекаем имя файла из пути
      const fileName = track.src.split('/').pop();
      if (!fileName) {
        console.warn(`⚠️  Не удалось извлечь имя файла из пути: ${track.src}`);
        continue;
      }

      const oldStoragePath = `${STORAGE_PATH}/${OLD_FOLDER_NAME}/${fileName}`;
      const newStoragePath = `${STORAGE_PATH}/${NEW_FOLDER_NAME}/${fileName}`;

      filesToRename.push({
        oldPath: oldStoragePath,
        newPath: newStoragePath,
        trackId: track.track_id,
      });
    }

    console.log(`📋 Файлов для переименования: ${filesToRename.length}\n`);

    // Проверяем, существует ли новая папка, если нет - создаём
    const newFolderPath = `${STORAGE_PATH}/${NEW_FOLDER_NAME}`;
    const { data: newFolderFiles } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(newFolderPath, { limit: 1 });

    if (!newFolderFiles) {
      console.log(`📁 Создаём новую папку: ${newFolderPath}`);
      // Создаём папку, загружая пустой файл (Supabase Storage не поддерживает пустые папки)
      // Но на самом деле папка создастся автоматически при загрузке первого файла
    }

    // Переименовываем файлы (копируем и удаляем старые)
    let renamedCount = 0;
    let errorCount = 0;

    for (const { oldPath, newPath, trackId } of filesToRename) {
      try {
        // Скачиваем файл
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .download(oldPath);

        if (downloadError || !fileData) {
          console.error(`❌ Ошибка при скачивании ${oldPath}:`, downloadError);
          errorCount++;
          continue;
        }

        // Загружаем в новое место
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(newPath, fileData, {
            upsert: true,
            contentType: 'audio/wav', // или определить по расширению
          });

        if (uploadError) {
          console.error(`❌ Ошибка при загрузке ${newPath}:`, uploadError);
          errorCount++;
          continue;
        }

        // Удаляем старый файл
        const { error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .remove([oldPath]);

        if (deleteError) {
          console.warn(`⚠️  Ошибка при удалении ${oldPath}:`, deleteError);
          // Продолжаем, даже если не удалось удалить старый файл
        }

        renamedCount++;
        console.log(`✅ [${trackId}] ${oldPath} -> ${newPath}`);
      } catch (error) {
        console.error(`❌ Ошибка при переименовании файла для трека ${trackId}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Переименовано файлов: ${renamedCount}`);
    console.log(`❌ Ошибок: ${errorCount}\n`);

    // 2. Обновляем пути в базе данных
    console.log('💾 Обновляем пути в базе данных...\n');

    let updatedCount = 0;
    for (const track of tracksResult.rows) {
      const newSrc = track.src.replace(`/audio/${OLD_FOLDER_NAME}/`, `/audio/${NEW_FOLDER_NAME}/`);

      await query(`UPDATE tracks SET src = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        newSrc,
        track.id,
      ]);

      updatedCount++;
      console.log(`✅ [${track.track_id}] ${track.src} -> ${newSrc}`);
    }

    console.log(`\n📊 Обновлено записей в БД: ${updatedCount}`);

    // 3. Удаляем старую папку, если она пустая
    console.log('\n🗑️  Проверяем старую папку...');
    const { data: oldFolderFiles } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(`${STORAGE_PATH}/${OLD_FOLDER_NAME}`, { limit: 100 });

    if (oldFolderFiles && oldFolderFiles.length === 0) {
      console.log('✅ Старая папка пуста, можно удалить вручную через интерфейс Supabase');
    } else if (oldFolderFiles && oldFolderFiles.length > 0) {
      console.log(`⚠️  В старой папке осталось ${oldFolderFiles.length} файлов`);
    }

    console.log('\n✨ Переименование завершено!');
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем переименование
if (require.main === module) {
  renameAudioFolder()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { renameAudioFolder };
