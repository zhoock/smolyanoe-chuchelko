#!/usr/bin/env tsx
/**
 * Скрипт миграции записей Recorded At, Mixed At, Mastered By в новый формат
 *
 * Преобразует старый формат:
 *   { text: ["OCT. 16, 2018—DEC. 28, 2018:", "Studio Name", ", Location."], link: "url" }
 *   или "OCT. 16, 2018: Studio Name, Location."
 *
 * В новый формат:
 *   { dateFrom: "2018-10-16", dateTo: "2018-12-28", studioText: "Studio Name, Location.", url: "url" }
 *
 * Использование:
 *   npm run migrate-recording-entries
 *   или
 *   npx tsx database/scripts/migrate-recording-entries-to-new-format.ts
 *
 * Требует переменную окружения DATABASE_URL
 */

import { query, closePool } from '../../netlify/functions/lib/db';
import { parseRecordingText } from '../../src/pages/UserDashboard/components/EditAlbumModal.utils';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем переменные окружения из .env файла, если он существует
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
  });
}

interface AlbumRow {
  id: string;
  album_id: string;
  lang: string;
  details: any;
}

/**
 * Парсит дату из формата "MON. DD, YYYY" в формат YYYY-MM-DD
 */
function parseDateFromDisplay(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;

  try {
    // Формат: "OCT. 16, 2018" или "OCT 16, 2018"
    const match = dateStr.match(/([A-Z]{3})\.?\s+(\d{1,2}),\s+(\d{4})/);
    if (!match) return undefined;

    const months: Record<string, number> = {
      JAN: 0,
      FEB: 1,
      MAR: 2,
      APR: 3,
      MAY: 4,
      JUN: 5,
      JUL: 6,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      NOV: 10,
      DEC: 11,
    };

    const month = months[match[1]];
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month === undefined || isNaN(day) || isNaN(year)) return undefined;

    const date = new Date(year, month, day);
    const yearStr = String(date.getFullYear());
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');

    return `${yearStr}-${monthStr}-${dayStr}`;
  } catch {
    return undefined;
  }
}

/**
 * Парсит русскую дату из формата "DD месяца YYYY" в формат YYYY-MM-DD
 */
function parseDateFromDisplayRU(
  dateStr: string | undefined
): { dateFrom: string; dateTo?: string } | undefined {
  if (!dateStr) return undefined;

  try {
    const months: Record<string, number> = {
      января: 0,
      февраля: 1,
      марта: 2,
      апреля: 3,
      мая: 4,
      июня: 5,
      июля: 6,
      августа: 7,
      сентября: 8,
      октября: 9,
      ноября: 10,
      декабря: 11,
    };

    // Формат: "16 октября 2018" или "16 октября 2018—28 декабря 2018"
    const rangeMatch = dateStr.match(
      /^(\d{1,2})\s+([а-яё]+)\s+(\d{4})—(\d{1,2})\s+([а-яё]+)\s+(\d{4})/
    );
    if (rangeMatch) {
      const day1 = parseInt(rangeMatch[1], 10);
      const month1 = months[rangeMatch[2]];
      const year1 = parseInt(rangeMatch[3], 10);
      const day2 = parseInt(rangeMatch[4], 10);
      const month2 = months[rangeMatch[5]];
      const year2 = parseInt(rangeMatch[6], 10);

      if (
        month1 !== undefined &&
        month2 !== undefined &&
        !isNaN(day1) &&
        !isNaN(day2) &&
        !isNaN(year1) &&
        !isNaN(year2)
      ) {
        const date1 = new Date(year1, month1, day1);
        const date2 = new Date(year2, month2, day2);
        return {
          dateFrom: `${String(date1.getFullYear())}-${String(date1.getMonth() + 1).padStart(2, '0')}-${String(date1.getDate()).padStart(2, '0')}`,
          dateTo: `${String(date2.getFullYear())}-${String(date2.getMonth() + 1).padStart(2, '0')}-${String(date2.getDate()).padStart(2, '0')}`,
        };
      }
    }

    // Формат: "16 октября 2018"
    const singleMatch = dateStr.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})/);
    if (singleMatch) {
      const day = parseInt(singleMatch[1], 10);
      const month = months[singleMatch[2]];
      const year = parseInt(singleMatch[3], 10);

      if (month !== undefined && !isNaN(day) && !isNaN(year)) {
        const date = new Date(year, month, day);
        return {
          dateFrom: `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        };
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Конвертирует старый формат записи в новый
 */
function convertToNewFormat(item: any, lang: 'en' | 'ru'): any | null {
  // Если уже новый формат, возвращаем как есть
  if (item && typeof item === 'object' && item.dateFrom) {
    return item;
  }

  // Старый формат: { text: [], link } или строка
  let text = '';
  let url: string | undefined = undefined;

  if (typeof item === 'object' && item?.text && Array.isArray(item.text)) {
    text = item.text.join('').trim();
    url = item.link ? String(item.link).trim() : undefined;
  } else if (typeof item === 'string' && item.trim()) {
    text = item.trim();
  }

  if (!text) return null;

  // Парсим текст для извлечения дат
  const parsed = parseRecordingText(text);

  // Если не удалось распарсить, пробуем парсить русские даты
  if (!parsed.dateFrom && lang === 'ru') {
    const ruParsed = parseDateFromDisplayRU(text);
    if (ruParsed && typeof ruParsed === 'object' && 'dateFrom' in ruParsed) {
      // Извлекаем studioText из текста
      const studioMatch = text.match(/:\s*(.+)$/);
      return {
        dateFrom: ruParsed.dateFrom,
        dateTo: ruParsed.dateTo,
        studioText: studioMatch ? studioMatch[1].trim() : text.trim(),
        url: url || null,
      };
    }
  }

  if (!parsed.dateFrom && !parsed.studioText) {
    // Если не удалось распарсить, возвращаем null (пропускаем)
    return null;
  }

  return {
    dateFrom: parsed.dateFrom || null,
    dateTo: parsed.dateTo || null,
    studioText: parsed.studioText || text.trim(),
    url: url || null,
  };
}

/**
 * Мигрирует блок Recorded At, Mixed At или Mastered By
 */
function migrateBlock(
  details: any[],
  titleEN: string,
  titleRU: string
): { updated: boolean; newContent: any[] } {
  const block = details.find((d) => d && (d.title === titleEN || d.title === titleRU));

  if (!block || !Array.isArray(block.content)) {
    return { updated: false, newContent: block?.content || [] };
  }

  const lang = block.title === titleRU ? 'ru' : 'en';
  const newContent: any[] = [];

  for (const item of block.content) {
    const converted = convertToNewFormat(item, lang);
    if (converted) {
      newContent.push(converted);
    }
  }

  if (newContent.length === block.content.length) {
    block.content = newContent;
    return { updated: true, newContent };
  }

  return { updated: false, newContent: block.content };
}

/**
 * Основная функция миграции
 */
async function migrateRecordingEntries(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Please set it: export DATABASE_URL=postgresql://user:pass@host:port/db');
    process.exit(1);
  }

  console.log('🚀 Начинаем миграцию записей Recorded At, Mixed At, Mastered By...\n');

  try {
    // Получаем все альбомы
    const albumsResult = await query<AlbumRow>(
      `SELECT id, album_id, lang, details FROM albums WHERE details IS NOT NULL`,
      [],
      0
    );

    console.log(`📦 Найдено альбомов: ${albumsResult.rows.length}\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const album of albumsResult.rows) {
      if (!album.details || !Array.isArray(album.details)) {
        totalSkipped++;
        continue;
      }

      const details = [...album.details];
      let hasChanges = false;

      // Мигрируем Recorded At
      const recordedResult = migrateBlock(details, 'Recorded At', 'Запись');
      if (recordedResult.updated) {
        hasChanges = true;
        console.log(`  ✅ ${album.album_id} (${album.lang}): Recorded At обновлен`);
      }

      // Мигрируем Mixed At
      const mixedResult = migrateBlock(details, 'Mixed At', 'Сведение');
      if (mixedResult.updated) {
        hasChanges = true;
        console.log(`  ✅ ${album.album_id} (${album.lang}): Mixed At обновлен`);
      }

      // Мигрируем Mastered By
      const masteredResult = migrateBlock(details, 'Mastered By', 'Мастеринг');
      if (masteredResult.updated) {
        hasChanges = true;
        console.log(`  ✅ ${album.album_id} (${album.lang}): Mastered By обновлен`);
      }

      if (hasChanges) {
        // Обновляем альбом в базе
        await query(
          `UPDATE albums SET details = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(details), album.id],
          0
        );
        totalUpdated++;
      } else {
        totalSkipped++;
      }
    }

    console.log('\n✨ Миграция завершена!');
    console.log(`📊 Итого:`);
    console.log(`   Обновлено альбомов: ${totalUpdated}`);
    console.log(`   Пропущено альбомов: ${totalSkipped}`);
  } catch (error) {
    console.error('\n❌ Ошибка при миграции:', error);

    if (error instanceof Error) {
      console.error(`   → ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    }

    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем скрипт
if (require.main === module) {
  migrateRecordingEntries()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}
