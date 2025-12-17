-- Миграция: Принудительное обновление ВСЕХ имен обложек
-- Обновляет все записи, которые НЕ содержат smolyanoe-chuchelko-Cover

-- Шаг 1: Обновляем все записи с Tar-Baby-Cover (любые варианты)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb(REPLACE(cover->>'img', 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover'))
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' != ''
  AND cover->>'img' LIKE '%Tar-Baby-Cover%';

-- Шаг 2: Обновляем все записи с форматом albumId-cover (например, 23-cover, smolyanoechuchelko-cover)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb('smolyanoe-chuchelko-Cover-' || album_id)
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' != ''
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%'
  AND (
    cover->>'img' = album_id || '-cover'
    OR cover->>'img' ~ '^[0-9]+-cover$'
    OR cover->>'img' LIKE album_id || '-cover%'
  );

-- Шаг 3: Обновляем все остальные записи, которые не содержат smolyanoe-chuchelko-Cover
-- и содержат слово "cover" (на всякий случай)
UPDATE albums
SET cover = jsonb_set(
  cover,
  '{img}',
  to_jsonb('smolyanoe-chuchelko-Cover-' || album_id)
),
updated_at = NOW()
WHERE cover IS NOT NULL
  AND cover->>'img' IS NOT NULL
  AND cover->>'img' != ''
  AND cover->>'img' NOT LIKE '%smolyanoe-chuchelko-Cover%'
  AND cover->>'img' ILIKE '%cover%'
  AND cover->>'img' NOT LIKE 'smolyanoe-chuchelko-Cover%';

