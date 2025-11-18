-- Миграция: Удаление дубликатов альбомов
-- Оставляет только одну запись для каждого album_id + lang
-- Приоритет: публичные альбомы (user_id IS NULL)

-- Удаляем дубликаты, оставляя только одну запись для каждого album_id + lang
-- Приоритет: публичные (user_id IS NULL), затем самые старые по created_at
DELETE FROM albums
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY album_id, lang 
             ORDER BY 
               CASE WHEN user_id IS NULL THEN 0 ELSE 1 END,
               created_at ASC
           ) as rn
    FROM albums
  ) t
  WHERE rn > 1
);

COMMENT ON TABLE albums IS 'Альбомы пользователей (после очистки дубликатов)';

