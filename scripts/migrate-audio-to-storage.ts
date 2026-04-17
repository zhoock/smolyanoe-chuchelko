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

import { promises as fs } from 'fs';
import * as path from 'path';
import { uploadFileAdmin } from '../src/shared/api/storage';

/**
 * Определяет MIME тип по расширению файла
 */
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * Рекурсивно читает файлы из директории
 */
async function readFilesRecursively(
  dir: string,
  baseDir: string
): Promise<Array<{ filePath: string; relativePath: string }>> {
  const files: Array<{ filePath: string; relativePath: string }> = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      const subFiles = await readFilesRecursively(fullPath, baseDir);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name !== '.gitkeep' && !entry.name.endsWith('.ts')) {
      files.push({ filePath: fullPath, relativePath });
    }
  }

  return files;
}

/**
 * Миграция локальных аудио файлов в Supabase Storage
 */
async function migrateAudioFilesToStorage() {
  const targetUserId = process.env.MIGRATION_TARGET_USER_ID?.trim();
  if (!targetUserId) {
    console.error('❌ Задайте MIGRATION_TARGET_USER_ID (UUID пользователя в Storage).');
    process.exit(1);
  }

  const audioDir = path.resolve(__dirname, '../src/audio');

  console.log('🚀 Начало миграции аудио файлов в Supabase Storage...\n');
  console.log(`📁 Исходная директория: ${audioDir}\n`);

  let totalFiles = 0;
  let uploadedFiles = 0;
  let failedFiles = 0;
  let totalSize = 0;

  try {
    // Проверяем существование директории
    await fs.access(audioDir);
  } catch {
    console.error(`❌ Директория ${audioDir} не найдена`);
    return;
  }

  // Получаем все аудио файлы рекурсивно
  const files = await readFilesRecursively(audioDir, audioDir);

  if (files.length === 0) {
    console.log('ℹ️  Аудио файлы не найдены\n');
    return;
  }

  console.log(`📦 Найдено файлов: ${files.length}\n`);

  for (const { filePath, relativePath } of files) {
    totalFiles++;
    const fileName = path.basename(filePath);
    const contentType = getContentType(fileName);

    try {
      const stats = await fs.stat(filePath);
      totalSize += stats.size;

      const fileBuffer = await fs.readFile(filePath);
      const fileBlob = new Blob([fileBuffer], { type: contentType });

      // Используем относительный путь как fileName (например, "23/01-Barnums-Fijian-Mermaid-1644.wav")
      const storageFileName = relativePath.replace(/\\/g, '/'); // Заменяем обратные слеши на прямые

      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   📤 Загрузка: ${storageFileName} (${fileSizeMB} MB)...`);

      const url = await uploadFileAdmin({
        userId: targetUserId,
        category: 'audio',
        file: fileBlob,
        fileName: storageFileName,
        contentType,
        upsert: true, // Перезаписываем, если файл уже существует
      });

      if (url) {
        uploadedFiles++;
        console.log(`   ✅ Загружено: ${storageFileName}`);
      } else {
        failedFiles++;
        console.log(`   ❌ Ошибка загрузки: ${storageFileName}`);
      }
    } catch (error) {
      failedFiles++;
      console.error(`   ❌ Ошибка при обработке ${relativePath}:`, error);
    }
  }

  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
  const totalSizeGB = (totalSize / 1024 / 1024 / 1024).toFixed(2);

  console.log('\n' + '='.repeat(50));
  console.log('📊 Итоги миграции:');
  console.log(`   Всего файлов: ${totalFiles}`);
  console.log(`   ✅ Успешно загружено: ${uploadedFiles}`);
  console.log(`   ❌ Ошибок: ${failedFiles}`);
  console.log(`   📦 Общий размер: ${totalSizeMB} MB (${totalSizeGB} GB)`);
  console.log('='.repeat(50) + '\n');

  if (failedFiles === 0) {
    console.log('🎉 Миграция завершена успешно!');
  } else {
    console.log('⚠️  Миграция завершена с ошибками. Проверьте логи выше.');
  }
}

migrateAudioFilesToStorage().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
