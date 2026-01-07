-- Скрипт для удаления дубликатов треков из альбома "23-remastered"
-- Удаляем треки без "(2025 Mix)" в названии, оставляя только ремиксы

-- Сначала проверяем, какие треки будут удалены
SELECT 
  a.id as album_uuid,
  a.album_id,
  t.track_id,
  t.title,
  t.id as track_uuid
FROM albums a
INNER JOIN tracks t ON t.album_id = a.id
WHERE a.album_id = '23-remastered' 
  AND a.lang = 'ru'
  AND t.title NOT LIKE '%(2025 Mix)%'
ORDER BY t.order_index;

-- Удаляем треки без "(2025 Mix)" из альбома "23-remastered"
DELETE FROM tracks
WHERE album_id IN (
  SELECT id FROM albums 
  WHERE album_id = '23-remastered' AND lang = 'ru'
)
AND title NOT LIKE '%(2025 Mix)%';

-- Проверяем результат
SELECT 
  a.album_id,
  t.track_id,
  t.title,
  t.order_index
FROM albums a
INNER JOIN tracks t ON t.album_id = a.id
WHERE a.album_id = '23-remastered' AND a.lang = 'ru'
ORDER BY t.order_index;
