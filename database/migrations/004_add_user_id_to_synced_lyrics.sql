-- Миграция: Добавление user_id в synced_lyrics
-- Дата: 2025

-- Добавляем колонку user_id (NULL для публичных синхронизаций)
ALTER TABLE synced_lyrics 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Добавляем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_synced_lyrics_user_id ON synced_lyrics(user_id);

-- Обновляем уникальный constraint, чтобы учитывать user_id
-- Удаляем старый constraint (CASCADE автоматически удалит связанный индекс)
-- Используем известное имя constraint из ошибки
ALTER TABLE synced_lyrics 
DROP CONSTRAINT IF EXISTS synced_lyrics_album_id_track_id_lang_key CASCADE;

-- Создаём новый уникальный constraint с user_id
-- NULL значения считаются разными, поэтому можно иметь несколько публичных версий
ALTER TABLE synced_lyrics
ADD CONSTRAINT synced_lyrics_user_album_track_lang_unique 
UNIQUE (user_id, album_id, track_id, lang);

-- Комментарий
COMMENT ON COLUMN synced_lyrics.user_id IS 'ID владельца синхронизации (NULL для публичных)';

