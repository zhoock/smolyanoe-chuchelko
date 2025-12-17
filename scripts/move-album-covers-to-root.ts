/**
 * Скрипт для перемещения обложек альбомов из подпапок в корень albums/
 * в Supabase Storage
 *
 * Использование:
 *   tsx scripts/move-album-covers-to-root.ts
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

const STORAGE_BUCKET_NAME = 'user-media';
const USER_ID = 'zhoock';
const STORAGE_ALBUMS_PATH = `users/${USER_ID}/albums`;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Ошибка: Не найдены переменные окружения Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface StorageItem {
  name: string;
  id: string | null;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: any;
}

/**
 * Получает все элементы с пагинацией
 */
async function listAllItems(path: string): Promise<StorageItem[]> {
  const allItems: StorageItem[] = [];
  let offset = 0;
  const limit = 100; // Безопасный лимит для Supabase Storage

  while (true) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(path, { limit, offset });

    if (error) {
      throw new Error(`Failed to list items at ${path}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    allItems.push(...data);

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allItems;
}

/**
 * Проверяет, является ли файл изображением обложки альбома
 */
function isImageFile(name: string): boolean {
  return /\.(jpg|jpeg|png|webp)$/i.test(name);
}

/**
 * Служебные папки, которые не нужно обрабатывать
 */
const IGNORE_FOLDERS = new Set(['_conflicts']);

/**
 * Определяет, является ли элемент папкой для обработки
 * Используем item.id === null — это надёжный способ определения папок в Supabase Storage
 */
function isFolderItem(item: StorageItem): boolean {
  if (IGNORE_FOLDERS.has(item.name)) return false;
  return item.id === null; // Supabase Storage помечает папки как id === null
}

/**
 * Определяет, является ли элемент файлом изображения
 */
function isImageItem(item: StorageItem): boolean {
  return isImageFile(item.name);
}

async function moveFilesFromSubfolders() {
  console.log('🚀 Начинаем перемещение файлов из подпапок в корень albums/\n');

  // Получаем список всех элементов в albums/ (с пагинацией)
  let folders: StorageItem[];
  try {
    folders = await listAllItems(STORAGE_ALBUMS_PATH);
  } catch (error) {
    console.error('❌ Ошибка при получении списка папок:', error);
    process.exit(1);
  }

  if (!folders || folders.length === 0) {
    console.log('⚠️  Папки не найдены');
    process.exit(0);
  }

  // Фильтруем только папки (не файлы) и файлы отдельно
  // Используем item.id === null для определения папок (надёжно)
  // И фильтруем только изображения для файлов
  const subfolders = folders.filter(isFolderItem);
  const rootFiles = folders.filter(isImageItem);

  if (subfolders.length === 0) {
    console.log('✅ Все файлы уже в корне albums/');
    process.exit(0);
  }

  console.log(`Найдено подпапок: ${subfolders.length}`);
  console.log(`Файлов в корне: ${rootFiles.length}\n`);

  // Создаём Set с именами файлов в корне (для быстрой проверки)
  const rootNames = new Set(rootFiles.map((f) => f.name));

  let movedCount = 0;
  let errorCount = 0;
  let conflictCount = 0;

  for (const subfolder of subfolders) {
    const subfolderPath = `${STORAGE_ALBUMS_PATH}/${subfolder.name}`;
    console.log(`📦 Обрабатываю папку: ${subfolder.name}`);

    // Получаем список файлов в подпапке (с пагинацией)
    let files: StorageItem[];
    try {
      files = await listAllItems(subfolderPath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Ошибка при получении файлов: ${errorMsg}`);
      errorCount++;
      continue;
    }

    if (!files || files.length === 0) {
      console.log(`   ℹ️  Файлы не найдены`);
      continue;
    }

    // Фильтруем только изображения (пропускаем .DS_Store, thumbs.db и т.д.)
    const filesToMove = files.filter((f) => isImageFile(f.name));

    if (filesToMove.length === 0) {
      console.log(`   ℹ️  Изображений не найдено (всего файлов: ${files.length})`);
      continue;
    }

    console.log(`   Найдено изображений: ${filesToMove.length} (всего файлов: ${files.length})\n`);

    for (const file of filesToMove) {
      const sourcePath = `${subfolderPath}/${file.name}`;
      const targetPath = `${STORAGE_ALBUMS_PATH}/${file.name}`;

      // Проверяем, существует ли файл в корне (быстрая проверка через Set)
      if (rootNames.has(file.name)) {
        // Безопасно: перемещаем конфликтный файл в _conflicts/ для ручной проверки
        // Добавляем timestamp чтобы при повторных запусках не было коллизий
        const timestamp = Date.now();
        const conflictPath = `${STORAGE_ALBUMS_PATH}/_conflicts/${subfolder.name}/${timestamp}-${file.name}`;
        console.log(`   ⚠️  Конфликт: ${file.name} уже существует в корне`);
        console.log(`      Перемещаю в: ${conflictPath}`);

        const { error: moveError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .move(sourcePath, conflictPath);

        if (moveError) {
          console.error(`   ❌ Ошибка при перемещении конфликта: ${moveError.message}`);
          errorCount++;
        } else {
          conflictCount++;
        }
        continue;
      }

      // Перемещаем файл серверно (без скачивания)
      const { error: moveError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .move(sourcePath, targetPath);

      if (moveError) {
        console.error(`   ❌ Ошибка при перемещении ${file.name}: ${moveError.message}`);
        errorCount++;
        continue;
      }

      // Добавляем в Set для последующих проверок
      rootNames.add(file.name);
      console.log(`   ✅ Перемещен: ${file.name}`);
      movedCount++;
    }

    console.log();
  }

  // Итоги
  console.log('─'.repeat(60));
  console.log('\n📊 Итоги перемещения:');
  console.log(`   ✅ Перемещено в корень: ${movedCount}`);
  console.log(`   ⚠️  Конфликтов (в _conflicts/): ${conflictCount}`);
  console.log(`   ❌ Ошибок: ${errorCount}\n`);

  if (errorCount > 0) {
    console.log('⚠️  Некоторые файлы не были перемещены. Проверьте ошибки выше.');
    process.exit(1);
  } else {
    console.log('✅ Перемещение завершено успешно!');
  }
}

moveFilesFromSubfolders().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
