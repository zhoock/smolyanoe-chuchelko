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
        process.env[key] = value; // Убираем проверку !process.env[key], чтобы перезаписать
      }
    }
  });
  console.log('✅ Переменные окружения загружены из .env.local');
} else {
  console.log('⚠️  Файл .env.local не найден');
}

import { promises as fs } from 'fs';
import * as path from 'path';
import { uploadFileAdmin } from '../src/shared/api/storage';
import { CURRENT_USER_CONFIG, type ImageCategory } from '../src/config/user';

/**
 * Определяет MIME тип по расширению файла
 */
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
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
    } else if (entry.isFile() && entry.name !== '.gitkeep') {
      files.push({ filePath: fullPath, relativePath });
    }
  }

  return files;
}

/**
 * Миграция локальных файлов в Supabase Storage
 */
async function migrateLocalFilesToStorage() {
  const imagesDir = path.resolve(__dirname, '../src/images/users/zhoock');
  const categories: ImageCategory[] = ['albums', 'articles', 'profile', 'stems', 'uploads'];

  console.log('🚀 Начало миграции файлов в Supabase Storage...\n');
  console.log(`📁 Исходная директория: ${imagesDir}\n`);

  let totalFiles = 0;
  let uploadedFiles = 0;
  let failedFiles = 0;

  for (const category of categories) {
    const categoryDir = path.join(imagesDir, category);

    try {
      // Проверяем существование директории
      try {
        await fs.access(categoryDir);
      } catch {
        console.log(`⚠️  Директория ${category} не найдена, пропускаем...\n`);
        continue;
      }

      console.log(`📦 Обработка категории: ${category}`);
      const files = await readFilesRecursively(categoryDir, categoryDir);

      if (files.length === 0) {
        console.log(`   ℹ️  Файлы не найдены\n`);
        continue;
      }

      console.log(`   Найдено файлов: ${files.length}\n`);

      for (const { filePath, relativePath } of files) {
        totalFiles++;
        const fileName = path.basename(filePath);
        const contentType = getContentType(fileName);

        try {
          const fileBuffer = await fs.readFile(filePath);
          const fileBlob = new Blob([fileBuffer], { type: contentType });

          // Для вложенных директорий (например, stems/23/file.png) используем относительный путь как fileName
          const storageFileName = relativePath.replace(/\\/g, '/'); // Заменяем обратные слеши на прямые для кроссплатформенности

          console.log(`   📤 Загрузка: ${storageFileName}...`);

          const url = await uploadFileAdmin({
            category,
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

      console.log(`\n✅ Категория ${category} обработана\n`);
    } catch (error) {
      console.error(`❌ Ошибка при обработке категории ${category}:`, error);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Итоги миграции:');
  console.log(`   Всего файлов: ${totalFiles}`);
  console.log(`   ✅ Успешно загружено: ${uploadedFiles}`);
  console.log(`   ❌ Ошибок: ${failedFiles}`);
  console.log('='.repeat(50) + '\n');

  if (failedFiles === 0) {
    console.log('🎉 Миграция завершена успешно!');
  } else {
    console.log('⚠️  Миграция завершена с ошибками. Проверьте логи выше.');
  }
}

migrateLocalFilesToStorage().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
