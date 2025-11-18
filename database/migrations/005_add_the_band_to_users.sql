-- Миграция: Добавление поля the_band в таблицу users
-- Дата: 2025

-- Добавляем поле the_band (JSONB) для хранения описания группы
ALTER TABLE users
ADD COLUMN IF NOT EXISTS the_band JSONB;

-- Комментарий для поля
COMMENT ON COLUMN users.the_band IS 'Описание группы (массив строк) для индивидуального пользователя';

