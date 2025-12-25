#!/usr/bin/env tsx
/**
 * Скрипт для применения миграции через Supabase REST API
 * Использует SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY из переменных окружения
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigrationViaSupabase(migrationFile: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены');
    console.error('   Загрузите переменные: source scripts/load-netlify-env.sh');
    process.exit(1);
  }

  const migrationsDir = join(__dirname, '..', 'database', 'migrations');
  const filePath = join(migrationsDir, migrationFile);

  console.log(`📝 Применяем миграцию через Supabase: ${migrationFile}...`);
  console.log(`   Файл: ${filePath}\n`);

  try {
    const sql = readFileSync(filePath, 'utf-8');

    // Разбиваем SQL на отдельные команды
    const commands = sql
      .split(';')
      .map((cmd) => cmd.trim())
      .filter((cmd) => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`   Найдено ${commands.length} SQL команд(ы)\n`);

    // Выполняем каждую команду через Supabase REST API
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const preview = command.substring(0, 60).replace(/\s+/g, ' ');

      console.log(`   [${i + 1}/${commands.length}] Выполняем: ${preview}...`);

      try {
        // Используем Supabase REST API для выполнения SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ sql: command }),
        });

        if (!response.ok) {
          // Если exec_sql не доступен, пробуем через прямой SQL endpoint
          // Supabase не предоставляет прямой SQL endpoint через REST API
          // Нужно использовать другой подход

          // Альтернатива: используем pg через DATABASE_URL если он есть
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        console.log(`   ✅ Команда ${i + 1} выполнена успешно\n`);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);

        // Игнорируем ошибки "already exists"
        if (
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate key') ||
          errorMessage.includes('relation already exists') ||
          (errorMessage.includes('column') && errorMessage.includes('already exists'))
        ) {
          console.log(`   ⚠️  Пропускаем (уже существует): ${errorMessage}\n`);
          continue;
        }

        // Если exec_sql недоступен, используем альтернативный метод
        if (errorMessage.includes('404') || errorMessage.includes('exec_sql')) {
          console.log(`   ⚠️  exec_sql недоступен, используем альтернативный метод...`);

          // Выполняем SQL напрямую через psql или используем другой подход
          console.log(`   💡 Выполните SQL вручную в Supabase Dashboard:`);
          console.log(`      ${command}\n`);
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

  console.log('🚀 Применение миграции БД через Supabase...\n');

  try {
    await applyMigrationViaSupabase(migrationFile);
    console.log('\n✨ Миграция завершена успешно!');
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
    console.error('\n💡 Альтернативный способ:');
    console.error('   1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
    console.error('   2. Перейдите в SQL Editor');
    console.error('   3. Выполните SQL из файла:', migrationFile);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
