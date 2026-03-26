-- Миграция: Добавление public_slug и default-флага публичного сайта
-- Дата: 2026
--
-- Цели:
-- 1) Добавить users.public_slug для публичной идентификации артиста
-- 2) Добавить users.is_default_public_site для выбора дефолтного артиста
-- 3) Безопасно подготовить схему к multi-artist без поломки текущего production-поведения

ALTER TABLE users
ADD COLUMN IF NOT EXISTS public_slug VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_default_public_site BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.public_slug IS 'Публичный slug артиста для маршрутизации контента';
COMMENT ON COLUMN users.is_default_public_site IS 'Является ли пользователь дефолтным публичным артистом';

-- Уникальность slug только для непустых значений
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_slug_unique
ON users (public_slug)
WHERE public_slug IS NOT NULL;

-- Ровно один default-пользователь (частичный уникальный индекс)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_default_public_site
ON users (is_default_public_site)
WHERE is_default_public_site = true;
