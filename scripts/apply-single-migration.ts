#!/usr/bin/env tsx
/**
 * Скрипт для применения одной миграции напрямую через Netlify функции
 * Использование: npx tsx scripts/apply-single-migration.ts 017_add_is_draft_to_articles.sql
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { query, closePool } from '../netlify/functions/lib/db';

async function applyMigration(migrationFile: string) {
  const migrationsDir = join(__dirname, '..', 'database', 'migrations');
  const filePath = join(migrationsDir, migrationFile);

  console.log(`📝 Применяем миграцию: ${migrationFile}...`);
  console.log(`   Файл: ${filePath}\n`);

  try {
    const sql = readFileSync(filePath, 'utf-8');

    // Разбиваем SQL на отдельные команды
    const commands = sql
      .split(';')
      .map((cmd) => cmd.trim())
      .filter((cmd) => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`   Найдено ${commands.length} SQL команд(ы)\n`);

    // Выполняем каждую команду
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const preview = command.substring(0, 60).replace(/\s+/g, ' ');

      console.log(`   [${i + 1}/${commands.length}] Выполняем: ${preview}...`);

      try {
        await query(command);
        console.log(`   ✅ Команда ${i + 1} выполнена успешно\n`);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);

        // Игнорируем ошибки "already exists" для IF NOT EXISTS
        if (
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate key') ||
          errorMessage.includes('relation already exists') ||
          (errorMessage.includes('column') && errorMessage.includes('already exists'))
        ) {
          console.log(`   ⚠️  Пропускаем (уже существует): ${errorMessage}\n`);
          continue;
        }

        throw error;
      }
    }

    console.log(`✅ Миграция ${migrationFile} применена успешно!`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка применения миграции ${migrationFile}:`, error);
    throw error;
  }
}

async function main() {
  const migrationFile = process.argv[2] || '017_add_is_draft_to_articles.sql';

  if (!migrationFile.endsWith('.sql')) {
    console.error('❌ Укажите файл миграции с расширением .sql');
    process.exit(1);
  }

  console.log('🚀 Применение миграции БД...\n');

  try {
    // Тестируем подключение
    await query('SELECT 1');
    console.log('✅ Подключение к БД успешно\n');

    await applyMigration(migrationFile);

    console.log('\n✨ Миграция завершена успешно!');
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
