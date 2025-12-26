-- Миграция: Создание таблицы articles для пользовательских статей
-- Дата: 2025

-- Таблица статей
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL для публичных статей
  article_id VARCHAR(255) NOT NULL, -- уникальный идентификатор статьи (например, "1", "2", "6")
  name_article VARCHAR(500) NOT NULL, -- название статьи
  description TEXT, -- краткое описание
  img VARCHAR(500), -- путь к изображению
  date DATE NOT NULL, -- дата публикации
  details JSONB NOT NULL, -- массив деталей статьи (ArticledetailsProps[])
  lang VARCHAR(10) NOT NULL, -- 'en' или 'ru'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальный индекс: один пользователь - одна статья с одним article_id на язык
  UNIQUE(user_id, article_id, lang)
);

-- Индексы для статей
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_article_id ON articles(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_lang ON articles(lang);
CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_user_article_lang ON articles(user_id, article_id, lang);

-- Комментарии
COMMENT ON TABLE articles IS 'Статьи пользователей';
COMMENT ON COLUMN articles.user_id IS 'ID владельца статьи';
COMMENT ON COLUMN articles.article_id IS 'Уникальный идентификатор статьи';
COMMENT ON COLUMN articles.details IS 'Массив деталей статьи (JSONB)';

-- Триггер для обновления updated_at
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

