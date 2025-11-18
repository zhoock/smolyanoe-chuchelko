-- Миграция: Удаление дубликатов статей
-- Оставляет только одну запись для каждого article_id + lang
-- Приоритет: публичные статьи (user_id IS NULL)

-- Удаляем дубликаты, оставляя только одну запись для каждого article_id + lang
-- Приоритет: публичные (user_id IS NULL), затем самые старые по created_at
DELETE FROM articles
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY article_id, lang 
             ORDER BY 
               CASE WHEN user_id IS NULL THEN 0 ELSE 1 END,
               created_at ASC
           ) as rn
    FROM articles
  ) t
  WHERE rn > 1
);

COMMENT ON TABLE articles IS 'Статьи пользователей (после очистки дубликатов)';

