/**
 * Скрипт для миграции файлов из bucket 'user-images' в 'user-media'
 *
 * Использование:
 * 1. Создайте новый bucket 'user-media' в Supabase Dashboard
 * 2. Установите те же RLS политики, что и для 'user-images'
 * 3. Запустите: npx tsx scripts/migrate-bucket.ts
 *
 * Примечание: Убедитесь, что переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY установлены
 * или загрузите их через: source scripts/load-netlify-env.sh (если используете Netlify CLI)
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
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

import { createSupabaseClient } from '../src/config/supabase';

const OLD_BUCKET = 'user-images';
const NEW_BUCKET = 'user-media';

async function listAllFiles(
  bucket: string,
  folderPath: string = ''
): Promise<Array<{ path: string; name: string; size?: number }>> {
  const supabase = createSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const files: Array<{ path: string; name: string; size?: number }> = [];
  const { data, error } = await supabase.storage.from(bucket).list(folderPath, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    console.error(`Error listing ${folderPath}:`, error);
    return files;
  }

  if (!data) return files;

  for (const item of data) {
    const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;

    // В Supabase Storage папки имеют id === null и metadata === null
    // Файлы имеют id и metadata
    if (item.id === null && item.metadata === null) {
      // Это папка - рекурсивно получаем файлы из неё
      const subFiles = await listAllFiles(bucket, fullPath);
      files.push(...subFiles);
    } else if (item.id !== null) {
      // Это файл - получаем размер из metadata
      const size = item.metadata?.size ? parseInt(item.metadata.size, 10) : undefined;
      files.push({ path: fullPath, name: item.name, size });
    }
  }

  return files;
}

async function copyFile(bucket: string, filePath: string): Promise<boolean> {
  const supabase = createSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  // Скачиваем файл из старого bucket
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(OLD_BUCKET)
    .download(filePath);

  if (downloadError || !fileData) {
    console.error(`❌ Error downloading ${filePath}:`, downloadError);
    return false;
  }

  // Определяем MIME тип по расширению
  const getContentType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };

  const contentType = getContentType(filePath);

  // Загружаем файл в новый bucket
  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, fileData, {
    contentType,
    upsert: true, // Заменяем, если существует
    cacheControl: '3600',
  });

  if (uploadError) {
    console.error(`❌ Error uploading ${filePath}:`, uploadError);
    return false;
  }

  return true;
}

async function migrateBucket() {
  console.log('🚀 Начало миграции файлов из bucket...');
  console.log(`   Старый bucket: ${OLD_BUCKET}`);
  console.log(`   Новый bucket: ${NEW_BUCKET}\n`);

  const supabase = createSupabaseClient();
  if (!supabase) {
    console.error('❌ Supabase client is not available. Please set environment variables.');
    return;
  }

  // Проверяем существование buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError);
    return;
  }

  const oldBucketExists = buckets?.some((b) => b.name === OLD_BUCKET);
  const newBucketExists = buckets?.some((b) => b.name === NEW_BUCKET);

  if (!oldBucketExists) {
    console.error(`❌ Старый bucket "${OLD_BUCKET}" не найден!`);
    return;
  }

  if (!newBucketExists) {
    console.error(`❌ Новый bucket "${NEW_BUCKET}" не найден!`);
    console.error(`   Пожалуйста, создайте bucket "${NEW_BUCKET}" в Supabase Dashboard:`);
    console.error(`   1. Storage → New bucket`);
    console.error(`   2. Name: ${NEW_BUCKET}`);
    console.error(`   3. ✅ Public bucket`);
    console.error(`   4. Create bucket`);
    return;
  }

  console.log(`✅ Оба bucket существуют\n`);

  // Получаем список всех файлов из старого bucket
  console.log('📦 Получение списка файлов...');
  const files = await listAllFiles(OLD_BUCKET);
  console.log(`   Найдено файлов: ${files.length}\n`);

  if (files.length === 0) {
    console.log('ℹ️  Файлы не найдены. Миграция не требуется.');
    return;
  }

  // Копируем файлы
  let copiedCount = 0;
  let errorCount = 0;
  let totalSize = 0;

  for (const { path, name, size } of files) {
    try {
      // Используем размер из списка файлов
      if (size) {
        totalSize += size;
      }

      const fileSizeMB = size ? (size / 1024 / 1024).toFixed(2) : '?';
      console.log(`   📤 Копирование: ${path} (${fileSizeMB} MB)...`);

      const success = await copyFile(NEW_BUCKET, path);

      if (success) {
        console.log(`   ✅ Скопировано: ${path}`);
        copiedCount++;
      } else {
        console.log(`   ❌ Ошибка: ${path}`);
        errorCount++;
      }
    } catch (error) {
      console.error(`   ❌ Ошибка при обработке ${path}:`, error);
      errorCount++;
    }
  }

  console.log('\n==================================================');
  console.log('📊 Итоги миграции:');
  console.log(`   Всего файлов: ${files.length}`);
  console.log(`   ✅ Успешно скопировано: ${copiedCount}`);
  console.log(`   ❌ Ошибок: ${errorCount}`);
  console.log(`   📦 Общий размер: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('==================================================\n');

  if (errorCount === 0) {
    console.log('🎉 Миграция завершена успешно!');
    console.log(`\n📝 Следующие шаги:`);
    console.log(`   1. Проверьте файлы в новом bucket "${NEW_BUCKET}"`);
    console.log(`   2. Убедитесь, что RLS политики настроены для "${NEW_BUCKET}"`);
    console.log(`   3. После проверки можно удалить старый bucket "${OLD_BUCKET}" (опционально)`);
  } else {
    console.log('⚠️  Миграция завершена с ошибками. Проверьте логи выше.');
  }
}

migrateBucket().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
