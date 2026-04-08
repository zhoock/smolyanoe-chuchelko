-- Migration: Create genres table and add FK for users.genre_code
-- Date: 2026
--
-- Строки ниже должны совпадать с CANONICAL_GENRES в src/shared/constants/canonicalGenres.ts

CREATE TABLE IF NOT EXISTS genres (
  code TEXT PRIMARY KEY,
  label_en TEXT NOT NULL,
  label_ru TEXT NOT NULL
);

INSERT INTO genres (code, label_en, label_ru) VALUES
  ('grunge', 'Grunge', 'Гранж'),
  ('alternative', 'Alternative', 'Альтернатива'),
  ('punk', 'Punk', 'Панк'),
  ('rock', 'Rock', 'Рок'),
  ('metal', 'Metal', 'Метал'),
  ('other', 'Other', 'Другое')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS genre_code TEXT;

-- genre_code must exist and be non-null for clustering logic
UPDATE users
SET genre_code = 'other'
WHERE genre_code IS NULL OR btrim(genre_code) = ''
   OR genre_code NOT IN (SELECT code FROM genres);

ALTER TABLE users
ALTER COLUMN genre_code SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE users
  ADD CONSTRAINT fk_users_genre
  FOREIGN KEY (genre_code) REFERENCES genres(code);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

