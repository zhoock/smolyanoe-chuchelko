-- Миграция: Создание таблицы для синхронизированных текстов песен
-- Дата: 2024

-- Таблица для хранения синхронизированных текстов с тайм-кодами
CREATE TABLE IF NOT EXISTS synced_lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id VARCHAR(255) NOT NULL,
  track_id VARCHAR(255) NOT NULL,
  lang VARCHAR(10) NOT NULL,
  synced_lyrics JSONB NOT NULL, -- Массив строк с тайм-кодами
  authorship TEXT, -- Текст авторства (опционально)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальный индекс: один трек - одна синхронизация на язык
  UNIQUE(album_id, track_id, lang)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_synced_lyrics_album_id ON synced_lyrics(album_id);
CREATE INDEX IF NOT EXISTS idx_synced_lyrics_track_id ON synced_lyrics(track_id);
CREATE INDEX IF NOT EXISTS idx_synced_lyrics_lang ON synced_lyrics(lang);
CREATE INDEX IF NOT EXISTS idx_synced_lyrics_album_track_lang ON synced_lyrics(album_id, track_id, lang);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE synced_lyrics IS 'Синхронизированные тексты песен с тайм-кодами для караоке';
COMMENT ON COLUMN synced_lyrics.id IS 'Уникальный идентификатор записи';
COMMENT ON COLUMN synced_lyrics.album_id IS 'ID альбома';
COMMENT ON COLUMN synced_lyrics.track_id IS 'ID трека';
COMMENT ON COLUMN synced_lyrics.lang IS 'Язык (en, ru)';
COMMENT ON COLUMN synced_lyrics.synced_lyrics IS 'JSON массив строк с тайм-кодами: [{text, startTime, endTime?}]';
COMMENT ON COLUMN synced_lyrics.authorship IS 'Текст авторства (опционально)';
COMMENT ON COLUMN synced_lyrics.created_at IS 'Дата создания';
COMMENT ON COLUMN synced_lyrics.updated_at IS 'Дата последнего обновления';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_synced_lyrics_updated_at
  BEFORE UPDATE ON synced_lyrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

