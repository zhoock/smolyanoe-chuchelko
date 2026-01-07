-- Скрипт для миграции путей header_images с users/zhoock/hero/ на users/{UUID}/hero/
-- Запуск: Выполните этот скрипт в Supabase SQL Editor

-- Шаг 1: Проверяем текущие пути header_images
SELECT 
  id,
  email,
  header_images,
  array_length(header_images::text[], 1) as images_count
FROM users
WHERE header_images IS NOT NULL 
  AND header_images::text != '[]'::text
  AND header_images::text LIKE '%zhoock%';

-- Шаг 2: Получаем UUID пользователя zhoock@zhoock.ru
DO $$
DECLARE
  target_user_id UUID;
  old_path_pattern TEXT := 'users/zhoock/hero/';
  new_path_pattern TEXT;
  updated_count INTEGER;
BEGIN
  -- Находим UUID пользователя
  SELECT id INTO target_user_id
  FROM users
  WHERE email = 'zhoock@zhoock.ru'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Пользователь zhoock@zhoock.ru не найден';
  END IF;

  -- Формируем новый путь с UUID
  new_path_pattern := 'users/' || target_user_id::text || '/hero/';

  RAISE NOTICE 'UUID пользователя: %', target_user_id;
  RAISE NOTICE 'Старый путь: %', old_path_pattern;
  RAISE NOTICE 'Новый путь: %', new_path_pattern;

  -- Обновляем пути в header_images
  UPDATE users
  SET header_images = (
    SELECT jsonb_agg(
      CASE
        WHEN value::text LIKE '%' || old_path_pattern || '%' THEN
          jsonb(replace(value::text, old_path_pattern, new_path_pattern))
        ELSE
          value
      END
    )
    FROM jsonb_array_elements(header_images)
  ),
  updated_at = NOW()
  WHERE header_images IS NOT NULL
    AND header_images::text LIKE '%' || old_path_pattern || '%'
    AND id = target_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Обновлено записей: %', updated_count;
END $$;

-- Шаг 3: Проверяем результат
SELECT 
  id,
  email,
  header_images,
  array_length(header_images::text[], 1) as images_count
FROM users
WHERE email = 'zhoock@zhoock.ru'
  AND header_images IS NOT NULL 
  AND header_images::text != '[]'::text;

