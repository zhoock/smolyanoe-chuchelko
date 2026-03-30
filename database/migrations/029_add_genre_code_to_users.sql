-- Migration: Add canonical genre_code to users and backfill from albums.details
-- Date: 2026
--
-- Goal:
-- 1) Store canonical genre code in users.genre_code
-- 2) Backfill existing rows from latest album details
-- 3) Use 'other' as safe fallback

ALTER TABLE users
ADD COLUMN IF NOT EXISTS genre_code TEXT;

WITH latest_album AS (
  SELECT DISTINCT ON (a.user_id)
    a.user_id,
    a.details
  FROM albums a
  ORDER BY a.user_id, a.updated_at DESC NULLS LAST, a.created_at DESC NULLS LAST
),
genre_raw AS (
  SELECT
    la.user_id,
    (
      SELECT lower(btrim(regexp_replace(content_item, '\.+$', '', 'g')))
      FROM jsonb_array_elements(la.details::jsonb) AS detail(item)
      CROSS JOIN LATERAL (
        SELECT
          lower(COALESCE(detail.item->>'title', '')) AS title,
          detail.item->'content' AS content
      ) x
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN jsonb_typeof(x.content) = 'array' AND jsonb_array_length(x.content) > 0
            THEN x.content->>0
          ELSE ''
        END AS content_item
      ) c
      WHERE x.title LIKE '%genre%' OR x.title LIKE '%жанр%'
      LIMIT 1
    ) AS raw_genre
  FROM latest_album la
),
normalized AS (
  SELECT
    gr.user_id,
    CASE
      WHEN gr.raw_genre IN ('панк', 'punk') THEN 'punk'
      WHEN gr.raw_genre IN ('гранж', 'grunge') THEN 'grunge'
      WHEN gr.raw_genre IN ('рок', 'rock') THEN 'rock'
      WHEN gr.raw_genre IN ('альтернатива', 'alternative') THEN 'alternative'
      WHEN gr.raw_genre IN ('метал', 'metal') THEN 'metal'
      WHEN gr.raw_genre IS NULL OR gr.raw_genre = '' THEN 'other'
      ELSE 'other'
    END AS genre_code
  FROM genre_raw gr
)
UPDATE users u
SET genre_code = n.genre_code,
    updated_at = NOW()
FROM normalized n
WHERE u.id = n.user_id
  AND (u.genre_code IS NULL OR u.genre_code = '');

UPDATE users
SET genre_code = 'other',
    updated_at = NOW()
WHERE genre_code IS NULL OR genre_code = '';

ALTER TABLE users
ALTER COLUMN genre_code SET NOT NULL;

COMMENT ON COLUMN users.genre_code IS 'Canonical genre code used for clustering and logic';
