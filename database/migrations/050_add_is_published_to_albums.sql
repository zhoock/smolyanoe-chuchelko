-- Миграция: отделить одноразовую публикацию альбома от видимости (is_public)
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_albums_is_published ON albums(is_published);

COMMENT ON COLUMN albums.is_published IS 'Альбом опубликован (одноразовое действие). is_public — только видимость после публикации.';

-- Существующие публичные альбомы считаем опубликованными
UPDATE albums SET is_published = true WHERE is_public = true;
