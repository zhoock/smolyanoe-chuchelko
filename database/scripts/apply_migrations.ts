/**
 * Скрипт для автоматического применения миграций БД
 *
 * Использование:
 *   npx tsx database/scripts/apply_migrations.ts
 *
 * Или через Netlify Function:
 *   netlify functions:invoke apply-migrations
 */

import { query } from '../../netlify/functions/lib/db';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationResult {
  success: boolean;
  migration: string;
  error?: string;
}

async function applyMigration(filePath: string): Promise<MigrationResult> {
  const fileName = path.basename(filePath);
  console.log(`📝 Применяем миграцию: ${fileName}...`);

  try {
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Разбиваем SQL на отдельные запросы (разделитель: ;)
    // Убираем комментарии и пустые строки
    const queries = sql
      .split(';')
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && !q.startsWith('--'));

    // Выполняем каждый запрос
    for (const queryText of queries) {
      if (queryText.trim().length > 0) {
        try {
          await query(queryText, []);
        } catch (error) {
          // Игнорируем ошибки "already exists" для CREATE TABLE IF NOT EXISTS
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes('already exists') ||
            errorMessage.includes('duplicate key') ||
            errorMessage.includes('relation already exists')
          ) {
            console.log(`  ⚠️  Пропускаем (уже существует): ${queryText.substring(0, 50)}...`);
            continue;
          }
          throw error;
        }
      }
    }

    console.log(`  ✅ Миграция ${fileName} применена успешно`);
    return { success: true, migration: fileName };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Ошибка применения миграции ${fileName}:`, errorMessage);
    return {
      success: false,
      migration: fileName,
      error: errorMessage,
    };
  }
}

async function applyAllMigrations(): Promise<void> {
  console.log('🚀 Начинаем применение миграций БД...\n');

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = [
    '003_create_users_albums_tracks.sql',
    '004_add_user_id_to_synced_lyrics.sql',
  ];

  const results: MigrationResult[] = [];

  for (const migrationFile of migrationFiles) {
    const filePath = path.join(migrationsDir, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Файл миграции не найден: ${filePath}`);
      results.push({
        success: false,
        migration: migrationFile,
        error: 'File not found',
      });
      continue;
    }

    const result = await applyMigration(filePath);
    results.push(result);
    console.log(''); // Пустая строка для читаемости
  }

  // Итоги
  console.log('📊 Итоги применения миграций:');
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`  ✅ Успешно: ${successful}`);
  console.log(`  ❌ Ошибок: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Ошибки:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.migration}: ${r.error}`);
      });
    throw new Error(`Применение миграций завершилось с ошибками`);
  }

  console.log('\n🎉 Все миграции применены успешно!');
}

// Если скрипт запускается напрямую
if (require.main === module) {
  applyAllMigrations()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { applyAllMigrations };
