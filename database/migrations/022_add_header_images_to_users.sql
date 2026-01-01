-- Миграция: Добавление поля header_images в таблицу users
-- Дата: 2025

ALTER TABLE users
ADD COLUMN IF NOT EXISTS header_images JSONB DEFAULT '[]'::jsonb;

-- Комментарий для поля
COMMENT ON COLUMN users.header_images IS 'Массив URL изображений для шапки сайта (hero section)';

