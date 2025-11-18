/**
 * Netlify Function для применения миграций БД
 *
 * Использование:
 *   netlify functions:invoke apply-migrations
 *
 * Или через HTTP:
 *   POST /api/apply-migrations
 *
 * ВАЖНО: Добавьте проверку авторизации перед использованием в production!
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
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

  // TODO: Добавить проверку авторизации для безопасности
  // const authHeader = event.headers.authorization;
  // if (!authHeader || !isValidAdminToken(authHeader)) {
  //   return {
  //     statusCode: 401,
  //     headers,
  //     body: JSON.stringify({ success: false, error: 'Unauthorized' }),
  //   };
  // }

  try {
    console.log('🚀 Начинаем применение миграций БД...\n');

    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
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
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const summary = {
      success: failed === 0,
      message: failed === 0 ? 'All migrations applied successfully' : 'Some migrations failed',
      results: {
        successful,
        failed,
        details: results,
      },
    };

    console.log('📊 Итоги:', summary);

    return {
      statusCode: failed === 0 ? 200 : 500,
      headers,
      body: JSON.stringify(summary),
    };
  } catch (error) {
    console.error('❌ Критическая ошибка применения миграций:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
