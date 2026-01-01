#!/usr/bin/env tsx
/**
 * Скрипт для ручного добавления уже выполненных миграций в schema_migrations
 *
 * Использование:
 *   npx tsx scripts/mark-migration-executed.ts 003_create_users_albums_tracks.sql
 *
 * Требует переменную окружения DATABASE_URL
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

// Загружаем переменные окружения из .env
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

async function markMigrationExecuted() {
  const migrationFilename = process.argv[2];

  if (!migrationFilename) {
    console.error('❌ Укажите имя файла миграции');
    console.error(
      '   Пример: npx tsx scripts/mark-migration-executed.ts 003_create_users_albums_tracks.sql'
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Создаем таблицу для отслеживания миграций, если её нет
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Проверяем, не выполнена ли уже миграция
    const checkResult = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [
      migrationFilename,
    ]);

    if (checkResult.rows.length > 0) {
      console.log(`⚠️  Миграция ${migrationFilename} уже отмечена как выполненная`);
      return;
    }

    // Добавляем миграцию
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [migrationFilename]);

    console.log(`✅ Миграция ${migrationFilename} отмечена как выполненная`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

markMigrationExecuted()
  .then(() => {
    console.log('🎉 Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
