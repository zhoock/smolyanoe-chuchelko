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
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

const MIGRATION_007 = `
-- Миграция: Разрешение NULL для user_id в таблице articles
-- Позволяет создавать публичные статьи (user_id = NULL)
ALTER TABLE articles
ALTER COLUMN user_id DROP NOT NULL;
`;

const MIGRATION_008 = `
-- Миграция: Удаление дубликатов альбомов
-- Оставляет только одну запись для каждого album_id + lang
-- Приоритет: публичные альбомы (user_id IS NULL)
DELETE FROM albums
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
);
`;

const MIGRATION_009 = `
-- Миграция: Удаление дубликатов статей
-- Оставляет только одну запись для каждого article_id + lang
-- Приоритет: публичные статьи (user_id IS NULL)
DELETE FROM articles
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY article_id, lang 
             ORDER BY 
               CASE WHEN user_id IS NULL THEN 0 ELSE 1 END,
               created_at ASC
           ) as rn
    FROM articles
  ) t
  WHERE rn > 1
);
`;

const MIGRATION_010 = `
-- Миграция: Привязка всех публичных данных к владельцу сайта
-- Владелец: zhoock@zhoock.ru
-- Все публичные данные (user_id IS NULL) привязываются к этому пользователю
-- Новые пользователи получат пустой сайт

DO $$
DECLARE
  owner_user_id UUID;
  albums_updated INTEGER;
  tracks_updated INTEGER;
  synced_lyrics_updated INTEGER;
  articles_updated INTEGER;
BEGIN
  -- Находим ID пользователя-владельца по email
  SELECT id INTO owner_user_id
  FROM users
  WHERE email = 'zhoock@zhoock.ru'
  LIMIT 1;

  -- Если пользователь не найден, создаём его
  IF owner_user_id IS NULL THEN
    INSERT INTO users (email, name, is_active)
    VALUES ('zhoock@zhoock.ru', 'Site Owner', true)
    RETURNING id INTO owner_user_id;
  END IF;

  -- Привязываем все публичные альбомы к владельцу и делаем их приватными
  UPDATE albums
  SET user_id = owner_user_id,
      is_public = false,
      updated_at = NOW()
  WHERE user_id IS NULL;

  GET DIAGNOSTICS albums_updated = ROW_COUNT;

  -- Обновляем треки для привязанных альбомов
  UPDATE tracks
  SET updated_at = NOW()
  WHERE album_id IN (
    SELECT id FROM albums WHERE user_id = owner_user_id
  );

  GET DIAGNOSTICS tracks_updated = ROW_COUNT;

  -- Привязываем все публичные синхронизации к владельцу
  UPDATE synced_lyrics
  SET user_id = owner_user_id,
      updated_at = NOW()
  WHERE user_id IS NULL;

  GET DIAGNOSTICS synced_lyrics_updated = ROW_COUNT;

  -- Привязываем все публичные статьи к владельцу и делаем их приватными
  UPDATE articles
  SET user_id = owner_user_id,
      is_public = false,
      updated_at = NOW()
  WHERE user_id IS NULL;

  GET DIAGNOSTICS articles_updated = ROW_COUNT;
END $$;
`;

const MIGRATION_011 = `
-- Миграция: Обновление имен обложек альбомов
-- Заменяет старые имена обложек (Tar-Baby-Cover-*, 23-cover) на новые (smolyanoe-chuchelko-Cover-*)
-- Это нужно для совместимости с новой системой именования файлов

DO $$
DECLARE
  album_record RECORD;
  old_cover_img TEXT;
  new_cover_img TEXT;
  updated_count INTEGER := 0;
BEGIN
  -- Проходим по всем альбомам
  FOR album_record IN 
    SELECT id, cover, album_id
    FROM albums
    WHERE cover IS NOT NULL
  LOOP
    -- Извлекаем старое имя обложки из JSON
    old_cover_img := album_record.cover->>'img';
    
    -- Пропускаем, если имя обложки пустое
    IF old_cover_img IS NULL OR old_cover_img = '' THEN
      CONTINUE;
    END IF;
    
    -- Пропускаем, если уже в новом формате
    IF old_cover_img LIKE 'smolyanoe-chuchelko-Cover%' THEN
      CONTINUE;
    END IF;
    
    -- Определяем новое имя в зависимости от старого
    new_cover_img := NULL;
    
    -- Случай 1: Tar-Baby-Cover-*
    IF old_cover_img LIKE 'Tar-Baby-Cover%' THEN
      new_cover_img := REPLACE(old_cover_img, 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover');
    -- Случай 2: 23-cover или albumId-cover
    ELSIF old_cover_img LIKE '%-cover' OR old_cover_img = '23-cover' THEN
      new_cover_img := 'smolyanoe-chuchelko-Cover-' || album_record.album_id;
    END IF;
    
    -- Обновляем альбом, если нашли новое имя
    IF new_cover_img IS NOT NULL THEN
      UPDATE albums
      SET cover = jsonb_set(
        cover,
        '{img}',
        to_jsonb(new_cover_img)
      ),
      updated_at = NOW()
      WHERE id = album_record.id;
      
      updated_count := updated_count + 1;
      
      RAISE NOTICE 'Обновлен альбом %: % -> %', album_record.album_id, old_cover_img, new_cover_img;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Всего обновлено альбомов: %', updated_count;
END $$;
`;

const MIGRATION_012 = `
-- Миграция: Принудительное обновление имен обложек альбомов (улучшенная версия)
-- Обновляет все старые имена обложек на новые, включая различные варианты

DO $$
DECLARE
  album_record RECORD;
  old_cover_img TEXT;
  new_cover_img TEXT;
  updated_count INTEGER := 0;
BEGIN
  -- Проходим по всем альбомам
  FOR album_record IN 
    SELECT id, cover, album_id
    FROM albums
    WHERE cover IS NOT NULL
  LOOP
    -- Извлекаем старое имя обложки из JSON
    old_cover_img := album_record.cover->>'img';
    
    -- Пропускаем, если имя обложки пустое
    IF old_cover_img IS NULL OR old_cover_img = '' THEN
      CONTINUE;
    END IF;
    
    -- Пропускаем, если уже в новом формате
    IF old_cover_img LIKE 'smolyanoe-chuchelko-Cover%' THEN
      CONTINUE;
    END IF;
    
    -- Определяем новое имя в зависимости от старого
    new_cover_img := NULL;
    
    -- Случай 1: Tar-Baby-Cover-* (любые варианты)
    IF old_cover_img LIKE '%Tar-Baby-Cover%' THEN
      new_cover_img := REPLACE(old_cover_img, 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover');
    -- Случай 2: 23-cover или просто albumId-cover
    ELSIF old_cover_img ~ '^[0-9]+-cover$' OR old_cover_img = album_record.album_id || '-cover' THEN
      new_cover_img := 'smolyanoe-chuchelko-Cover-' || album_record.album_id;
    -- Случай 3: Любое имя, содержащее только albumId и "cover"
    ELSIF old_cover_img LIKE album_record.album_id || '-cover%' AND old_cover_img NOT LIKE 'smolyanoe-chuchelko%' THEN
      new_cover_img := 'smolyanoe-chuchelko-Cover-' || album_record.album_id;
    END IF;
    
    -- Обновляем альбом, если нашли новое имя
    IF new_cover_img IS NOT NULL THEN
      UPDATE albums
      SET cover = jsonb_set(
        cover,
        '{img}',
        to_jsonb(new_cover_img)
      ),
      updated_at = NOW()
      WHERE id = album_record.id;
      
      updated_count := updated_count + 1;
      
      RAISE NOTICE 'Обновлен альбом %: % -> %', album_record.album_id, old_cover_img, new_cover_img;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Всего обновлено альбомов: %', updated_count;
END $$;
`;

const MIGRATION_013 = `
-- Миграция: Прямое обновление всех имен обложек альбомов
-- Обновляет ВСЕ записи, где cover.img содержит старые имена

-- Обновляем все записи с Tar-Baby-Cover
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb(REPLACE(cover->>'img', 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover'))
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' LIKE '%Tar-Baby-Cover%'
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%';

-- Обновляем все записи с форматом albumId-cover (например, 23-cover)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb('smolyanoe-chuchelko-Cover-' || album_id)
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND (cover->>'img' = album_id || '-cover' OR cover->>'img' ~ '^[0-9]+-cover$')
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%';
`;

const MIGRATION_014 = `
-- Миграция: Принудительное обновление ВСЕХ имен обложек
-- Обновляет все записи, которые НЕ содержат smolyanoe-chuchelko-Cover

-- Шаг 1: Обновляем все записи с Tar-Baby-Cover (любые варианты)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb(REPLACE(cover->>'img', 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover'))
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' != ''
  AND cover->>'img' LIKE '%Tar-Baby-Cover%';

-- Шаг 2: Обновляем все записи с форматом albumId-cover (например, 23-cover, smolyanoechuchelko-cover)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb('smolyanoe-chuchelko-Cover-' || album_id)
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' != ''
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%'
  AND (
    cover->>'img' = album_id || '-cover'
    OR cover->>'img' ~ '^[0-9]+-cover$'
    OR cover->>'img' LIKE album_id || '-cover%'
  );

-- Шаг 3: Обновляем все остальные записи, которые не содержат smolyanoe-chuchelko-Cover
-- и содержат слово "cover" (на всякий случай)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb('smolyanoe-chuchelko-Cover-' || album_id)
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' != ''
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%'
  AND cover->>'img' ILIKE '%cover%'
  AND cover->>'img' NOT LIKE 'smolyanoe-chuchelko-Cover%';
`;

const MIGRATIONS: Record<string, string> = {
  '003_create_users_albums_tracks.sql': MIGRATION_003,
  '004_add_user_id_to_synced_lyrics.sql': MIGRATION_004,
  '005_add_the_band_to_users.sql': MIGRATION_005,
  '006_create_articles.sql': MIGRATION_006,
  '007_alter_articles_user_id_nullable.sql': MIGRATION_007,
  '008_remove_duplicate_albums.sql': MIGRATION_008,
  '009_remove_duplicate_articles.sql': MIGRATION_009,
  '010_claim_public_data_to_owner.sql': MIGRATION_010,
  '011_update_album_cover_names.sql': MIGRATION_011,
  '012_force_update_album_cover_names.sql': MIGRATION_012,
  '013_direct_update_album_covers.sql': MIGRATION_013,
  '014_force_all_covers.sql': MIGRATION_014,
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
      '007_alter_articles_user_id_nullable.sql',
      '008_remove_duplicate_albums.sql',
      '009_remove_duplicate_articles.sql',
      '010_claim_public_data_to_owner.sql',
      '011_update_album_cover_names.sql',
      '012_force_update_album_cover_names.sql',
      '013_direct_update_album_covers.sql',
      '014_force_all_covers.sql',
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
