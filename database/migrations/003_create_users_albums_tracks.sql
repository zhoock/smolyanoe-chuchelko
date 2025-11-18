-- Миграция: Создание таблиц для мультипользовательской системы
-- Дата: 2025

-- 1. Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash TEXT, -- для будущей аутентификации
  the_band JSONB, -- описание группы (массив строк) для индивидуального пользователя
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для пользователей
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Комментарии
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON COLUMN users.id IS 'Уникальный идентификатор пользователя';
COMMENT ON COLUMN users.email IS 'Email пользователя (уникальный)';
COMMENT ON COLUMN users.name IS 'Имя пользователя';
COMMENT ON COLUMN users.the_band IS 'Описание группы (массив строк) для индивидуального пользователя';
COMMENT ON COLUMN users.is_active IS 'Активен ли пользователь';

-- 2. Таблица альбомов
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL для публичных альбомов
  album_id VARCHAR(255) NOT NULL, -- уникальный идентификатор (например, "23-remastered")
  artist VARCHAR(255) NOT NULL,
  album VARCHAR(255) NOT NULL,
  full_name VARCHAR(500),
  description TEXT,
  cover JSONB, -- {img, format, densities?, sizes?}
  release JSONB, -- {date, UPC, photographer, ...}
  buttons JSONB, -- {itunes, spotify, ...}
  details JSONB, -- массив деталей
  lang VARCHAR(10) NOT NULL, -- 'en' или 'ru'
  is_public BOOLEAN DEFAULT false, -- публичный или приватный
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальный индекс: один пользователь - один альбом на язык
  UNIQUE(user_id, album_id, lang)
);

-- Индексы для альбомов
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_albums_album_id ON albums(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_lang ON albums(lang);
CREATE INDEX IF NOT EXISTS idx_albums_is_public ON albums(is_public);
CREATE INDEX IF NOT EXISTS idx_albums_user_album_lang ON albums(user_id, album_id, lang);

-- Комментарии
COMMENT ON TABLE albums IS 'Альбомы пользователей';
COMMENT ON COLUMN albums.user_id IS 'ID владельца (NULL для публичных)';
COMMENT ON COLUMN albums.album_id IS 'Уникальный идентификатор альбома';
COMMENT ON COLUMN albums.is_public IS 'Публичный ли альбом';

-- 3. Таблица треков
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  track_id VARCHAR(255) NOT NULL, -- ID трека в альбоме (например, "1")
  title VARCHAR(500) NOT NULL,
  duration DECIMAL(10, 2), -- длительность в секундах
  src VARCHAR(500), -- путь к аудиофайлу
  content TEXT, -- обычный текст (без синхронизации)
  authorship TEXT, -- авторство
  synced_lyrics JSONB, -- синхронизированный текст из JSON (опционально, для fallback)
  order_index INTEGER DEFAULT 0, -- порядок в альбоме
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальный индекс: один трек - один ID в альбоме
  UNIQUE(album_id, track_id)
);

-- Индексы для треков
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_track_id ON tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_tracks_order_index ON tracks(album_id, order_index);

-- Комментарии
COMMENT ON TABLE tracks IS 'Треки альбомов';
COMMENT ON COLUMN tracks.track_id IS 'ID трека в альбоме';
COMMENT ON COLUMN tracks.order_index IS 'Порядок трека в альбоме';

-- Триггеры для обновления updated_at
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

