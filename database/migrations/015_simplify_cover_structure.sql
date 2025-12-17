-- Упрощаем структуру cover: из {img: "..."} в просто "..."
-- Шаг 1: Создаём временный столбец для хранения строки
ALTER TABLE albums ADD COLUMN IF NOT EXISTS cover_temp TEXT;

-- Шаг 2: Копируем img из jsonb в временный столбец
UPDATE albums
SET cover_temp = cover->>'img'
WHERE cover IS NOT NULL 
  AND cover::text != '{}' 
  AND cover ? 'img';

-- Шаг 3: Удаляем старый столбец
ALTER TABLE albums DROP COLUMN cover;

-- Шаг 4: Переименовываем временный столбец в cover
ALTER TABLE albums RENAME COLUMN cover_temp TO cover;

