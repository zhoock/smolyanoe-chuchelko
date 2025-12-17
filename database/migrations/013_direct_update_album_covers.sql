-- Миграция: Прямое обновление всех имен обложек альбомов
-- Обновляет ВСЕ записи, где cover.img содержит старые имена

-- Обновляем все записи с Tar-Baby-Cover
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb(REPLACE(cover->>'img', 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover'))
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' LIKE '%Tar-Baby-Cover%'
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%';

-- Обновляем все записи с форматом albumId-cover (например, 23-cover)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb('smolyanoe-chuchelko-Cover-' || album_id)
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND (cover->>'img' = album_id || '-cover' OR cover->>'img' ~ '^[0-9]+-cover$')
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%';

