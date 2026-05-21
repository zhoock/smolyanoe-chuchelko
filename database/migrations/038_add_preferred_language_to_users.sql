-- User UI / transactional email locale (ru | en)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'en';

COMMENT ON COLUMN users.preferred_language IS 'Preferred UI and email language: ru or en';

UPDATE users
SET preferred_language = 'en'
WHERE preferred_language IS NULL OR preferred_language NOT IN ('ru', 'en');
