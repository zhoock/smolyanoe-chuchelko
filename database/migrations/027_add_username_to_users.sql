-- Миграция: Добавление поля username для поддержки пользовательских поддоменов
-- Дата: 2025

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(63);

-- Заполняем username для существующих пользователей
WITH prepared AS (
  SELECT
    id,
    LOWER(regexp_replace(split_part(email, '@', 1), '[^a-z0-9_]+', '-', 'g')) AS base_username
  FROM users
  WHERE username IS NULL
),
normalized AS (
  SELECT
    id,
    CASE
      WHEN base_username IS NULL OR base_username = ''
        THEN CONCAT('user-', SUBSTRING(id::text, 1, 8))
      ELSE base_username
    END AS candidate,
    ROW_NUMBER() OVER (PARTITION BY base_username ORDER BY id) AS duplicate_index
  FROM prepared
)
UPDATE users u
SET username = CASE
  WHEN normalized.duplicate_index = 1 THEN normalized.candidate
  ELSE CONCAT(normalized.candidate, '-', normalized.duplicate_index)
END
FROM normalized
WHERE u.id = normalized.id;

-- Гарантируем, что username всегда задан и уникален
ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users (username);

COMMENT ON COLUMN users.username IS 'Уникальное имя пользователя, используемое в поддомене';
