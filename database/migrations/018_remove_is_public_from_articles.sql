-- Миграция: Удаление неиспользуемого поля is_public из таблицы articles
-- Дата: 2025

-- Удаляем индекс
DROP INDEX IF EXISTS idx_articles_is_public;

-- Удаляем колонку
ALTER TABLE articles
DROP COLUMN IF EXISTS is_public;

