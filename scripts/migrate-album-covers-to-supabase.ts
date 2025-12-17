/**
 * Скрипт для миграции обложек альбомов из локальной папки в Supabase Storage
 *
 * Использование:
 *   npm run migrate-covers
 *   или
 *   tsx scripts/migrate-album-covers-to-supabase.ts
 *
 * Требует переменные окружения:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

// Загружаем переменные окружения из .env.local если файл существует
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Убираем кавычки если есть
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Переменные окружения загружены из .env.local');
} else {
  console.log('⚠️  Файл .env.local не найден');
}

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Конфигурация
const STORAGE_BUCKET_NAME = 'user-media';
const USER_ID = 'zhoock'; // ID пользователя
const LOCAL_ALBUMS_PATH = path.join(__dirname, '../src/images/users/zhoock/albums');
const STORAGE_ALBUMS_PATH = `users/${USER_ID}/albums`;

// Получаем переменные окружения
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Ошибка: Не найдены переменные окружения Supabase');
  console.error('   Требуются: SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Используйте: source scripts/load-netlify-env.sh');
  process.exit(1);
}

// Создаем Supabase клиент с правами администратора
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface FileInfo {
  localPath: string;
  storagePath: string;
  fileName: string;
  albumFolder?: string;
}

/**
 * Рекурсивно собирает все файлы изображений из папки
 */
function collectImageFiles(dir: string, baseDir: string = dir, albumFolder?: string): FileInfo[] {
  const files: FileInfo[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Рекурсивно обрабатываем подпапки
      const subFolder = entry.name;
      files.push(...collectImageFiles(fullPath, baseDir, subFolder));
    } else if (entry.isFile()) {
      // Проверяем, что это файл изображения
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.webp', '.png'].includes(ext)) {
        const fileName = entry.name;
        // Формируем путь в Storage
        // ВСЕ файлы сохраняем в корень albums/ (без подпапок)
        // Это нужно, потому что getUserImageUrl формирует путь как users/zhoock/albums/{fileName}
        // и не учитывает подпапки
        const storagePath = `${STORAGE_ALBUMS_PATH}/${fileName}`;

        files.push({
          localPath: fullPath,
          storagePath,
          fileName,
          albumFolder,
        });
      }
    }
  }

  return files;
}

/**
 * Загружает файл в Supabase Storage
 * @returns объект с результатом: { success: boolean, skipped: boolean }
 */
async function uploadFile(fileInfo: FileInfo): Promise<{ success: boolean; skipped: boolean }> {
  try {
    // Читаем файл
    const fileBuffer = fs.readFileSync(fileInfo.localPath);
    const fileStats = fs.statSync(fileInfo.localPath);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);

    // Определяем Content-Type
    const ext = path.extname(fileInfo.fileName).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }

    console.log(`📤 Загружаю: ${fileInfo.fileName} (${fileSizeKB} KB) → ${fileInfo.storagePath}`);

    // Проверяем, существует ли файл
    // Разбиваем путь Storage на директорию и имя файла
    const storagePathParts = fileInfo.storagePath.split('/');
    const fileName = storagePathParts.pop() || fileInfo.fileName;
    const dirPath = storagePathParts.join('/');

    // Проверяем существование файла
    const { data: existingFiles, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(dirPath, {
        search: fileName,
      });

    if (listError) {
      // Если папка не существует, это нормально - создадим при загрузке
      console.log(`   ℹ️  Папка не существует, будет создана: ${dirPath}`);
    } else if (existingFiles && existingFiles.length > 0) {
      // Проверяем точное совпадение имени
      const exactMatch = existingFiles.find((f) => f.name === fileName);
      if (exactMatch) {
        console.log(`   ⚠️  Файл уже существует, пропускаю`);
        return { success: true, skipped: true };
      }
    }

    // Загружаем файл
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(fileInfo.storagePath, fileBuffer, {
        contentType,
        upsert: false, // Не перезаписываем существующие файлы
      });

    if (error) {
      console.error(`   ❌ Ошибка загрузки: ${error.message}`);
      return { success: false, skipped: false };
    }

    console.log(`   ✅ Успешно загружен`);
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`   ❌ Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, skipped: false };
  }
}

/**
 * Основная функция миграции
 */
async function migrateCovers() {
  console.log('🚀 Начинаем миграцию обложек альбомов в Supabase Storage\n');
  console.log(`📁 Локальная папка: ${LOCAL_ALBUMS_PATH}`);
  console.log(`☁️  Storage путь: ${STORAGE_ALBUMS_PATH}\n`);

  // Проверяем существование локальной папки
  if (!fs.existsSync(LOCAL_ALBUMS_PATH)) {
    console.error(`❌ Ошибка: Локальная папка не найдена: ${LOCAL_ALBUMS_PATH}`);
    process.exit(1);
  }

  // Собираем все файлы изображений
  console.log('📋 Сканирую файлы...\n');
  const files = collectImageFiles(LOCAL_ALBUMS_PATH);

  if (files.length === 0) {
    console.log('⚠️  Файлы не найдены');
    process.exit(0);
  }

  console.log(`Найдено файлов: ${files.length}\n`);

  // Группируем по альбомам для удобства
  const filesByAlbum = new Map<string, FileInfo[]>();
  for (const file of files) {
    const albumKey = file.albumFolder || 'root';
    if (!filesByAlbum.has(albumKey)) {
      filesByAlbum.set(albumKey, []);
    }
    filesByAlbum.get(albumKey)!.push(file);
  }

  console.log(`Альбомов: ${filesByAlbum.size}\n`);
  console.log('─'.repeat(60));
  console.log();

  // Загружаем файлы
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const [albumKey, albumFiles] of filesByAlbum.entries()) {
    console.log(
      `📦 Альбом: ${albumKey === 'root' ? '(корень)' : albumKey} (${albumFiles.length} файлов)`
    );
    console.log();

    for (const file of albumFiles) {
      const result = await uploadFile(file);
      if (result.success) {
        if (result.skipped) {
          skipCount++;
        } else {
          successCount++;
        }
      } else {
        errorCount++;
      }
    }

    console.log();
  }

  // Итоги
  console.log('─'.repeat(60));
  console.log('\n📊 Итоги миграции:');
  console.log(`   ✅ Успешно загружено: ${successCount}`);
  console.log(`   ⏭️  Пропущено (уже существует): ${skipCount}`);
  console.log(`   ❌ Ошибок: ${errorCount}`);
  console.log(`   📁 Всего файлов: ${files.length}\n`);

  if (errorCount > 0) {
    console.log('⚠️  Некоторые файлы не были загружены. Проверьте ошибки выше.');
    process.exit(1);
  } else {
    console.log('✅ Миграция завершена успешно!');
  }
}

// Запускаем миграцию
migrateCovers().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
