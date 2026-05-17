-- Видимость статьи на сайте (как у треков): public | subscribers_only | hidden

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(24) NOT NULL DEFAULT 'public';

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_visibility_check;

ALTER TABLE articles
  ADD CONSTRAINT articles_visibility_check
  CHECK (visibility IN ('public', 'subscribers_only', 'hidden'));

CREATE INDEX IF NOT EXISTS idx_articles_visibility ON articles (visibility);

COMMENT ON COLUMN articles.visibility IS 'Доступ к статье на сайте: public | subscribers_only | hidden';
