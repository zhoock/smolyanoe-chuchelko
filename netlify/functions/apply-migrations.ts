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

// Встроенные SQL миграции (чтобы не зависеть от файловой системы в Netlify Functions)
const MIGRATION_003 = `
-- Миграция: Создание таблиц для мультипользовательской системы
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash TEXT,
  the_band JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  album_id VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  album VARCHAR(255) NOT NULL,
  full_name VARCHAR(500),
  description TEXT,
  cover JSONB,
  release JSONB,
  buttons JSONB,
  details JSONB,
  lang VARCHAR(10) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, album_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_albums_album_id ON albums(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_lang ON albums(lang);
CREATE INDEX IF NOT EXISTS idx_albums_is_public ON albums(is_public);
CREATE INDEX IF NOT EXISTS idx_albums_user_album_lang ON albums(user_id, album_id, lang);

CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  track_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  duration DECIMAL(10, 2),
  src VARCHAR(500),
  content TEXT,
  authorship TEXT,
  synced_lyrics JSONB,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(album_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_track_id ON tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_tracks_order_index ON tracks(album_id, order_index);

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_albums_updated_at
  BEFORE UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

const MIGRATION_004 = `
-- Миграция: Добавление user_id в synced_lyrics
ALTER TABLE synced_lyrics 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_synced_lyrics_user_id ON synced_lyrics(user_id);

-- Удаляем старый constraint (CASCADE автоматически удалит связанный индекс)
ALTER TABLE synced_lyrics 
DROP CONSTRAINT IF EXISTS synced_lyrics_album_id_track_id_lang_key CASCADE;

ALTER TABLE synced_lyrics
ADD CONSTRAINT synced_lyrics_user_album_track_lang_unique 
UNIQUE (user_id, album_id, track_id, lang);
`;

const MIGRATION_005 = `
-- Миграция: Добавление поля the_band в таблицу users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS the_band JSONB;
`;

const MIGRATION_006 = `
-- Миграция: Создание таблицы articles для пользовательских статей
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  article_id VARCHAR(255) NOT NULL,
  name_article VARCHAR(500) NOT NULL,
  description TEXT,
  img VARCHAR(500),
  date DATE NOT NULL,
  details JSONB NOT NULL,
  lang VARCHAR(10) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, article_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_article_id ON articles(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_lang ON articles(lang);
CREATE INDEX IF NOT EXISTS idx_articles_is_public ON articles(is_public);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_user_article_lang ON articles(user_id, article_id, lang);

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

const MIGRATIONS: Record<string, string> = {
  '003_create_users_albums_tracks.sql': MIGRATION_003,
  '004_add_user_id_to_synced_lyrics.sql': MIGRATION_004,
  '005_add_the_band_to_users.sql': MIGRATION_005,
  '006_create_articles.sql': MIGRATION_006,
};

async function applyMigration(migrationName: string, sql: string): Promise<MigrationResult> {
  console.log(`📝 Применяем миграцию: ${migrationName}...`);

  try {
    // Разбиваем SQL на отдельные запросы
    // Учитываем блоки DO $$ ... END $$; которые содержат вложенные ;
    const queries: string[] = [];
    let currentQuery = '';
    let inDoBlock = false;
    let dollarTag = '';

    const lines = sql.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Пропускаем комментарии
      if (trimmed.startsWith('--') || trimmed.length === 0) {
        continue;
      }

      currentQuery += line + '\n';

      // Проверяем начало блока DO $$
      if (trimmed.match(/^DO\s+\$\$/)) {
        inDoBlock = true;
        const match = trimmed.match(/\$\$(\w*)/);
        dollarTag = match ? match[1] : '';
        continue;
      }

      // Проверяем конец блока DO $$ ... END $$;
      if (inDoBlock && trimmed.match(new RegExp(`END\\s+\\$\\$${dollarTag}\\s*;?`))) {
        inDoBlock = false;
        dollarTag = '';
        // Блок завершён, добавляем запрос
        if (currentQuery.trim().length > 0) {
          queries.push(currentQuery.trim());
        }
        currentQuery = '';
        continue;
      }

      // Если не в блоке DO, проверяем обычные запросы
      if (!inDoBlock && trimmed.endsWith(';')) {
        if (currentQuery.trim().length > 0) {
          queries.push(currentQuery.trim());
        }
        currentQuery = '';
      }
    }

    // Добавляем последний запрос, если он есть
    if (currentQuery.trim().length > 0) {
      queries.push(currentQuery.trim());
    }

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

    console.log(`  ✅ Миграция ${migrationName} применена успешно`);
    return { success: true, migration: migrationName };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Ошибка применения миграции ${migrationName}:`, errorMessage);
    return {
      success: false,
      migration: migrationName,
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

    const migrationFiles = [
      '003_create_users_albums_tracks.sql',
      '004_add_user_id_to_synced_lyrics.sql',
      '005_add_the_band_to_users.sql',
      '006_create_articles.sql',
    ];

    const results: MigrationResult[] = [];

    for (const migrationFile of migrationFiles) {
      const sql = MIGRATIONS[migrationFile];

      if (!sql) {
        console.error(`❌ Миграция не найдена: ${migrationFile}`);
        results.push({
          success: false,
          migration: migrationFile,
          error: 'Migration not found in code',
        });
        continue;
      }

      const result = await applyMigration(migrationFile, sql);
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
