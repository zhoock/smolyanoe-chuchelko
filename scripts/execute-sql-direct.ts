#!/usr/bin/env tsx
/**
 * Выполняет SQL напрямую через Supabase используя service role key
 */

const SUPABASE_URL = 'https://jhpvetvfnsklpwswadle.supabase.co';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocHZldHZmbnNrbHB3c3dhZGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzI5MjE1NCwiZXhwIjoyMDc4ODY4MTU0fQ.IoWTG5S5sg60V1IcwCxfwmnfTPiic90Q8jCBTODgpbA';

const SQL_COMMANDS = [
  `ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;`,
  `CREATE INDEX IF NOT EXISTS idx_articles_is_draft ON articles(is_draft);`,
  `COMMENT ON COLUMN articles.is_draft IS 'Черновик статьи (true) или опубликованная статья (false)';`,
  `UPDATE articles SET is_draft = false WHERE is_draft IS NULL;`,
];

async function executeSQL(sql: string) {
  // Supabase не предоставляет прямой SQL endpoint через REST API
  // Используем альтернативный подход - выводим SQL для ручного выполнения
  // или используем Supabase Dashboard SQL Editor

  console.log('📝 SQL команда для выполнения:');
  console.log(sql);
  console.log('');

  // Пробуем использовать Supabase Management API (если доступен)
  try {
    // Supabase имеет ограниченный REST API для SQL
    // Лучший способ - использовать Supabase Dashboard или psql
    console.log('💡 Выполните SQL в Supabase Dashboard:');
    console.log('   1. Откройте https://supabase.com/dashboard');
    console.log('   2. Выберите проект: jhpvetvfnsklpwswadle');
    console.log('   3. Перейдите в SQL Editor');
    console.log('   4. Вставьте и выполните SQL команду выше\n');
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

async function main() {
  console.log('🚀 Применение миграции 017_add_is_draft_to_articles.sql\n');
  console.log('⚠️  Supabase REST API не поддерживает прямой SQL execution');
  console.log('    Используйте один из способов ниже:\n');

  console.log('📋 Способ 1: Supabase Dashboard (рекомендуется)');
  console.log(
    '   1. Откройте: https://supabase.com/dashboard/project/jhpvetvfnsklpwswadle/sql/new'
  );
  console.log('   2. Выполните следующие SQL команды:\n');

  for (const sql of SQL_COMMANDS) {
    await executeSQL(sql);
  }

  console.log('\n📋 Способ 2: Через psql (если установлен)');
  console.log('   Получите DATABASE_URL из Netlify Dashboard и выполните:');
  console.log('   psql "$DATABASE_URL" -f database/migrations/017_add_is_draft_to_articles.sql\n');

  console.log('✅ Миграция готова к применению!');
}

main().catch(console.error);
