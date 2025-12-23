#!/usr/bin/env tsx
/**
 * Скрипт для удаления дубликатов альбомов
 * Оставляет только одну запись для каждого album_id + lang
 * Приоритет: публичные альбомы (user_id IS NULL)
 *
 * Использование:
 *   npm run remove-duplicate-albums
 */

import { query, closePool } from '../../netlify/functions/lib/db';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем переменные окружения из .env файла
const envPath = path.resolve(__dirname, '../../.env');
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

async function removeDuplicateAlbums(): Promise<void> {
  console.log('🚀 Начинаем удаление дубликатов альбомов...\n');

  try {
    // Сначала показываем, сколько дубликатов есть
    const duplicatesResult = await query<{
      album_id: string;
      lang: string;
      count: number;
    }>(
      `SELECT album_id, lang, COUNT(*) as count
       FROM albums
       GROUP BY album_id, lang
       HAVING COUNT(*) > 1
       ORDER BY count DESC`
    );

    if (duplicatesResult.rows.length === 0) {
      console.log('✅ Дубликатов не найдено');
      return;
    }

    console.log(`📊 Найдено ${duplicatesResult.rows.length} групп дубликатов:\n`);
    for (const row of duplicatesResult.rows) {
      console.log(`  - ${row.album_id} (${row.lang}): ${row.count} записей`);
    }

    // Показываем детали дубликатов
    console.log('\n📋 Детали дубликатов:\n');
    for (const row of duplicatesResult.rows) {
      const detailsResult = await query<{
        id: string;
        album_id: string;
        lang: string;
        user_id: string | null;
        created_at: Date;
        is_public: boolean;
      }>(
        `SELECT id, album_id, lang, user_id, created_at, is_public
         FROM albums
         WHERE album_id = $1 AND lang = $2
         ORDER BY 
           CASE WHEN user_id IS NULL THEN 0 ELSE 1 END,
           created_at ASC`,
        [row.album_id, row.lang]
      );

      console.log(`  ${row.album_id} (${row.lang}):`);
      for (const detail of detailsResult.rows) {
        const userInfo = detail.user_id
          ? `user_id: ${detail.user_id}`
          : 'публичный (user_id: NULL)';
        console.log(
          `    - ${detail.id}: ${userInfo}, создан: ${detail.created_at.toISOString()}, публичный: ${detail.is_public}`
        );
      }
    }

    // Удаляем дубликаты, оставляя только одну запись для каждого album_id + lang
    // Приоритет: публичные (user_id IS NULL), затем самые старые по created_at
    const deleteResult = await query(
      `DELETE FROM albums
       WHERE id IN (
         SELECT id
         FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY album_id, lang 
                    ORDER BY 
                      CASE WHEN user_id IS NULL THEN 0 ELSE 1 END,
                      created_at ASC
                  ) as rn
           FROM albums
         ) t
         WHERE rn > 1
       )`
    );

    console.log(`\n✅ Удалено ${deleteResult.rowCount || 0} дубликатов`);

    // Проверяем результат
    const finalCheck = await query<{
      album_id: string;
      lang: string;
      count: number;
    }>(
      `SELECT album_id, lang, COUNT(*) as count
       FROM albums
       GROUP BY album_id, lang
       HAVING COUNT(*) > 1`
    );

    if (finalCheck.rows.length === 0) {
      console.log('✅ Все дубликаты удалены');
    } else {
      console.log(`⚠️  Осталось ${finalCheck.rows.length} групп дубликатов`);
      for (const row of finalCheck.rows) {
        console.log(`  - ${row.album_id} (${row.lang}): ${row.count} записей`);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка при удалении дубликатов:', error);
    throw error;
  }
}

if (require.main === module) {
  removeDuplicateAlbums()
    .then(() => {
      console.log('\n✅ Скрипт завершён успешно');
      closePool();
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Ошибка выполнения скрипта:', error);
      closePool();
      process.exit(1);
    });
}
