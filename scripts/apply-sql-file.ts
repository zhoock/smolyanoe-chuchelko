#!/usr/bin/env tsx
/**
 * Скрипт для выполнения SQL файла целиком
 * Использование: npx tsx scripts/apply-sql-file.ts database/migrations/021_create_purchases.sql
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { query, closePool } from '../netlify/functions/lib/db';

async function applySqlFile(sqlFilePath: string) {
  console.log(`📝 Применяем SQL файл: ${sqlFilePath}...\n`);

  try {
    const sql = readFileSync(sqlFilePath, 'utf-8');
    console.log('✅ SQL файл прочитан\n');

    // Выполняем весь SQL целиком (PostgreSQL поддерживает выполнение нескольких команд)
    console.log('📊 Выполняем SQL...');
    await query(sql);
    console.log('✅ SQL выполнен успешно!\n');

    return true;
  } catch (error) {
    console.error(`❌ Ошибка выполнения SQL:`, error);
    throw error;
  }
}

async function main() {
  const sqlFile = process.argv[2];

  if (!sqlFile) {
    console.error('❌ Укажите путь к SQL файлу');
    console.error(
      '   Пример: npx tsx scripts/apply-sql-file.ts database/migrations/021_create_purchases.sql'
    );
    process.exit(1);
  }

  // Если указан только имя файла, добавляем путь к migrations
  let sqlFilePath = sqlFile;
  if (!sqlFile.includes('/')) {
    sqlFilePath = join(__dirname, '..', 'database', 'migrations', sqlFile);
  } else {
    sqlFilePath = join(__dirname, '..', sqlFile);
  }

  console.log('🚀 Применение SQL файла...\n');

  try {
    // Тестируем подключение
    await query('SELECT 1');
    console.log('✅ Подключение к БД успешно\n');

    await applySqlFile(sqlFilePath);

    console.log('✨ SQL файл применен успешно!');
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
