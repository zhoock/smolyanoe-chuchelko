-- Миграция: Добавление user_id в synced_lyrics
-- Дата: 2025

-- Добавляем колонку user_id (NULL для публичных синхронизаций)
ALTER TABLE synced_lyrics 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Добавляем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_synced_lyrics_user_id ON synced_lyrics(user_id);

-- Обновляем уникальный индекс, чтобы учитывать user_id
-- Сначала удаляем старый индекс (если он существует)
DO $$
BEGIN
  -- Проверяем существование индекса перед удалением
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'synced_lyrics_album_id_track_id_lang_key'
  ) THEN
    DROP INDEX synced_lyrics_album_id_track_id_lang_key;
  END IF;
END $$;

-- Создаём новый уникальный индекс с user_id
-- NULL значения считаются разными, поэтому можно иметь несколько публичных версий
CREATE UNIQUE INDEX IF NOT EXISTS synced_lyrics_user_album_track_lang_unique 
ON synced_lyrics(user_id, album_id, track_id, lang);

-- Комментарий
COMMENT ON COLUMN synced_lyrics.user_id IS 'ID владельца синхронизации (NULL для публичных)';

