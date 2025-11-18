-- Миграция: Разрешение NULL для user_id в таблице articles
-- Позволяет создавать публичные статьи (user_id = NULL)

ALTER TABLE articles
ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN articles.user_id IS 'ID владельца статьи (NULL для публичных)';

