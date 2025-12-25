-- Миграция: Добавление поля is_draft в таблицу articles
-- Позволяет сохранять статьи как черновики

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Индекс для быстрого поиска черновиков
CREATE INDEX IF NOT EXISTS idx_articles_is_draft ON articles(is_draft);

-- Комментарий
COMMENT ON COLUMN articles.is_draft IS 'Черновик статьи (true) или опубликованная статья (false)';

-- Устанавливаем is_draft = false для всех существующих статей (они уже опубликованы)
UPDATE articles SET is_draft = false WHERE is_draft IS NULL;

