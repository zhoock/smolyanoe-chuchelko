#!/usr/bin/env tsx
/**
 * Скрипт для миграции изображений в новую структуру папок пользователя
 * Запуск: npx tsx scripts/migrate-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const IMAGES_DIR = path.resolve(__dirname, '../src/images');
const LEGACY_USER_DIR = process.env.MIGRATION_LOCAL_IMAGES_USER_DIR?.trim() || 'legacy-user';
const USER_DIR = path.join(IMAGES_DIR, 'users', LEGACY_USER_DIR);

// Категории и соответствующие им паттерны файлов
const MIGRATION_MAP: Record<string, string[]> = {
  albums: [
    'album_cover_smolyanoe_chuchelko_23',
    'album_cover_smolyanoe_chuchelko_EP',
    'smolyanoe-chuchelko-Cover-23',
    'smolyanoe-chuchelko-Cover-23-remastered',
    'smolyanoe-chuchelko-Cover',
  ],
  articles: [
    'yaroslav',
    'smolyanoe_chuchelko_effects_pedals',
    'effects_pedal_',
    'recording_',
    'mixing_',
    'bass_guitar_',
    'drum_recording_',
    'guitar_recording_',
  ],
  profile: ['yaroslav', 'banner-for-header'],
  stems: [], // Папка stems будет перемещена целиком
};

// Файлы, которые остаются в корне images/
const KEEP_IN_ROOT = ['logo.webp', 'Instagram_PhotoBorder-15.png'];
const KEEP_DIRS_IN_ROOT = ['hero', 'svg', 'users'];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Пропускаем папки, которые должны остаться в корне
      if (!KEEP_DIRS_IN_ROOT.includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function matchesPattern(fileName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => fileName.includes(pattern));
}

function migrateFile(filePath: string, category: string): boolean {
  // Проверяем, существует ли файл
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const fileName = path.basename(filePath);
  const destDir = path.join(USER_DIR, category);
  const destPath = path.join(destDir, fileName);

  // Если файл уже в нужной папке, пропускаем
  if (filePath === destPath) {
    return false;
  }

  // Создаем папку назначения, если её нет
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Перемещаем файл
  fs.renameSync(filePath, destPath);
  console.log(`✓ ${fileName} → users/${LEGACY_USER_DIR}/${category}/`);
  return true;
}

function main() {
  console.log('🚀 Начинаем миграцию изображений...\n');

  // Получаем все файлы из images/
  const allFiles = getAllFiles(IMAGES_DIR);

  // Мигрируем файлы по категориям
  let migratedCount = 0;
  const migratedFiles = new Set<string>();

  for (const [category, patterns] of Object.entries(MIGRATION_MAP)) {
    if (category === 'stems') {
      // Перемещаем папку stems целиком
      const stemsSource = path.join(IMAGES_DIR, 'stems');
      const stemsDest = path.join(USER_DIR, 'stems');

      if (fs.existsSync(stemsSource) && !fs.existsSync(stemsDest)) {
        if (!fs.existsSync(path.dirname(stemsDest))) {
          fs.mkdirSync(path.dirname(stemsDest), { recursive: true });
        }
        fs.renameSync(stemsSource, stemsDest);
        console.log(`✓ stems/ → users/${LEGACY_USER_DIR}/stems/`);
        migratedCount++;
      }
      continue;
    }

    // Обрабатываем файлы по паттернам
    for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath);

      // Пропускаем уже перемещенные файлы
      if (migratedFiles.has(filePath)) {
        continue;
      }

      // Пропускаем файлы, которые должны остаться в корне
      if (KEEP_IN_ROOT.includes(fileName)) {
        continue;
      }

      // Пропускаем файлы из папок, которые остаются в корне
      if (KEEP_DIRS_IN_ROOT.some((dir) => dirName.includes(dir))) {
        continue;
      }

      // Пропускаем файлы, которые уже в users/
      if (dirName.includes('users/')) {
        continue;
      }

      // Проверяем, соответствует ли файл паттернам категории
      if (matchesPattern(fileName, patterns)) {
        if (migrateFile(filePath, category)) {
          migratedFiles.add(filePath);
          migratedCount++;
        }
      }
    }
  }

  console.log(`\n✅ Миграция завершена! Перемещено файлов: ${migratedCount}`);
  console.log('\n📁 Структура после миграции:');
  console.log('   images/');
  console.log(`   ├── users/${LEGACY_USER_DIR}/`);
  console.log('   │   ├── albums/     (обложки альбомов)');
  console.log('   │   ├── articles/   (фото для статей)');
  console.log('   │   ├── profile/    (аватар, баннер)');
  console.log('   │   ├── stems/      (портреты для stems)');
  console.log('   │   └── uploads/    (для будущих загрузок)');
  console.log('   ├── hero/           (общие hero изображения)');
  console.log('   ├── svg/            (иконки)');
  console.log('   ├── logo.webp');
  console.log('   └── Instagram_PhotoBorder-15.png');
}

main();
