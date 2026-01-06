-- Миграция: Добавление поля site_name в таблицу users
-- Дата: 2025

ALTER TABLE users
ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);

-- Комментарий для поля
COMMENT ON COLUMN users.site_name IS 'Название сайта/группы (Site/Band Name) из формы регистрации';

