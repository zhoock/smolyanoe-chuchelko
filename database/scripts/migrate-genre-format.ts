/**
 * Миграция формата Genre в details
 * Старый формат: "content": ["Grunge, alternative rock."]
 * Новый формат: "content": ["grunge", "alternative rock"]
 *
 * Запуск: npx tsx database/scripts/migrate-genre-format.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const JSON_FILES = [
  join(process.cwd(), 'src/assets/albums-en.json'),
  join(process.cwd(), 'src/assets/albums-ru.json'),
];

function migrateGenreFormat(content: unknown[]): unknown[] {
  if (!Array.isArray(content)) {
    return content;
  }

  // Ищем элемент с title "Genre" или "Жанр"
  const genreIndex = content.findIndex(
    (item: unknown) =>
      item &&
      typeof item === 'object' &&
      'title' in item &&
      (item.title === 'Genre' ||
        item.title === 'Жанр' ||
        item.title === 'Genres' ||
        item.title === 'Жанры')
  );

  if (genreIndex === -1) {
    return content;
  }

  const genreDetail = content[genreIndex] as { title: string; content: unknown[]; id: number };
  const oldContent = genreDetail.content;

  if (!Array.isArray(oldContent) || oldContent.length === 0) {
    return content;
  }

  // Проверяем формат первого элемента
  const firstItem = oldContent[0];
  if (typeof firstItem !== 'string') {
    // Уже новый формат или другой формат
    return content;
  }

  // Если первый элемент содержит запятую - это старый формат ("Grunge, alternative rock.")
  if (firstItem.includes(',')) {
    // Конвертируем старый формат в новый
    const genreText = firstItem.trim();
    const parsedGenres = genreText
      .split(',')
      .map((g) => g.trim().replace(/\.$/, ''))
      .filter((g) => g.length > 0)
      .map((g) => g.toLowerCase());

    console.log(`Migrating genre from "${genreText}" to:`, parsedGenres);

    // Обновляем content
    const newContent = [...content];
    newContent[genreIndex] = {
      ...genreDetail,
      content: parsedGenres,
    };

    return newContent;
  } else {
    // Уже новый формат, но возможно не в нижнем регистре - нормализуем
    const normalizedGenres = oldContent
      .filter((item): item is string => typeof item === 'string')
      .map((g) => g.toLowerCase().trim())
      .filter((g) => g.length > 0);

    if (JSON.stringify(normalizedGenres) !== JSON.stringify(oldContent)) {
      console.log(`Normalizing genre case:`, oldContent, '->', normalizedGenres);
      const newContent = [...content];
      newContent[genreIndex] = {
        ...genreDetail,
        content: normalizedGenres,
      };
      return newContent;
    }
  }

  return content;
}

function migrateFile(filePath: string): void {
  console.log(`\nMigrating file: ${filePath}`);

  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const albums = JSON.parse(fileContent);

    if (!Array.isArray(albums)) {
      console.error(`File ${filePath} does not contain an array of albums`);
      return;
    }

    let migratedCount = 0;

    const migratedAlbums = albums.map((album: unknown) => {
      if (!album || typeof album !== 'object' || !('details' in album)) {
        return album;
      }

      const albumObj = album as { details: unknown[] };
      const originalDetails = albumObj.details;
      const migratedDetails = migrateGenreFormat(originalDetails);

      if (JSON.stringify(migratedDetails) !== JSON.stringify(originalDetails)) {
        migratedCount++;
        return {
          ...albumObj,
          details: migratedDetails,
        };
      }

      return album;
    });

    if (migratedCount > 0) {
      writeFileSync(filePath, JSON.stringify(migratedAlbums, null, 2) + '\n', 'utf-8');
      console.log(`✓ Migrated ${migratedCount} album(s)`);
    } else {
      console.log('✓ No albums need migration');
    }
  } catch (error) {
    console.error(`Error migrating file ${filePath}:`, error);
    process.exit(1);
  }
}

function main() {
  console.log('Starting Genre format migration...\n');

  JSON_FILES.forEach((filePath) => {
    migrateFile(filePath);
  });

  console.log('\n✓ Migration completed!');
}

main();
