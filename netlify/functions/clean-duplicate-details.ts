/**
 * Netlify Function для очистки дубликатов блоков в details альбомов
 *
 * Использование:
 *   netlify functions:invoke clean-duplicate-details
 *
 * Или через HTTP:
 *   POST /api/clean-duplicate-details
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';

interface CleanupResult {
  albumsProcessed: number;
  albumsUpdated: number;
  duplicatesRemoved: number;
  errors: string[];
}

// Заголовки блоков, которые могут дублироваться
const DUPLICATE_TITLES = [
  // Recorded At
  'Recorded At',
  'Запись',
  'Recording',
  // Mixed At
  'Mixed At',
  'Сведение',
  'Mixing',
  'Recording/Mixing', // Старое название
  // Mastering
  'Mastering',
  'Мастеринг',
];

function cleanDuplicateDetails(details: any[]): { cleaned: any[]; removed: number } {
  if (!Array.isArray(details)) {
    return { cleaned: [], removed: 0 };
  }

  const cleaned: any[] = [];
  const foundTitles = new Set<string>();
  let removed = 0;

  // Проходим по всем деталям
  for (const detail of details) {
    if (!detail || typeof detail !== 'object' || !detail.title) {
      // Если это не объект с title, просто добавляем его
      cleaned.push(detail);
      continue;
    }

    const title = String(detail.title).trim();

    // Проверяем, является ли этот блок потенциальным дубликатом
    const isDuplicateCandidate = DUPLICATE_TITLES.some((dupTitle) => title === dupTitle);

    if (!isDuplicateCandidate) {
      // Если это не дубликат, просто добавляем
      cleaned.push(detail);
      continue;
    }

    // Если это блок, который может дублироваться
    if (foundTitles.has(title)) {
      // Уже встречался - пропускаем (удаляем дубликат)
      removed++;
      console.log(`  ⚠️ Удалён дубликат блока: "${title}"`);
    } else {
      // Первый раз встречаем этот блок - добавляем
      foundTitles.add(title);
      cleaned.push(detail);
    }
  }

  return { cleaned, removed };
}

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Только POST запросы
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
    };
  }

  const result: CleanupResult = {
    albumsProcessed: 0,
    albumsUpdated: 0,
    duplicatesRemoved: 0,
    errors: [],
  };

  try {
    console.log('🚀 Начинаем очистку дубликатов в details альбомов...');

    // Получаем все альбомы из базы данных
    const albumsResult = await query<{
      user_id: string | null;
      album_id: string;
      lang: string;
      details: any;
    }>('SELECT user_id, album_id, lang, details FROM albums');

    console.log(`📊 Найдено ${albumsResult.rows.length} альбомов`);

    for (const album of albumsResult.rows) {
      try {
        result.albumsProcessed++;

        // Парсим details
        let details: any[] = [];
        if (album.details) {
          if (typeof album.details === 'string') {
            details = JSON.parse(album.details);
          } else if (Array.isArray(album.details)) {
            details = album.details;
          }
        }

        // Очищаем дубликаты
        const { cleaned, removed } = cleanDuplicateDetails(details);

        if (removed > 0) {
          // Обновляем альбом в базе данных
          await query(
            `UPDATE albums 
             SET details = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id IS NOT DISTINCT FROM $2 
               AND album_id = $3 
               AND lang = $4`,
            [JSON.stringify(cleaned), album.user_id, album.album_id, album.lang]
          );

          result.albumsUpdated++;
          result.duplicatesRemoved += removed;

          console.log(`✅ Альбом ${album.album_id} (${album.lang}): удалено ${removed} дубликатов`);
        }
      } catch (error) {
        const errorMsg = `Альбом ${album.album_id} (${album.lang}): ${
          error instanceof Error ? error.message : String(error)
        }`;
        result.errors.push(errorMsg);
        console.error('❌', errorMsg);
      }
    }

    console.log('✅ Очистка завершена:', result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result,
      }),
    };
  } catch (error) {
    console.error('❌ Критическая ошибка при очистке дубликатов:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        partialResult: result,
      }),
    };
  }
};
