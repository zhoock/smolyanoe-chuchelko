-- Миграция: RLS политики для защиты полей роли и статуса музыканта
-- Дата: 2025

-- Включаем RLS для таблицы users (если еще не включен)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут читать свои собственные данные
CREATE POLICY IF NOT EXISTS "Users can read their own data"
ON users
FOR SELECT
USING (auth.uid() = id);

-- Политика: Пользователи могут обновлять свои данные, но НЕ могут менять role и musician_status напрямую
-- Исключение: могут менять musician_status с 'none' на 'pending' или с 'rejected' на 'pending'
CREATE POLICY IF NOT EXISTS "Users can update their own data with restrictions"
ON users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Запрещаем изменение role (только админ может)
  AND (
    role = (SELECT role FROM users WHERE id = auth.uid())
    OR role = 'user' -- Разрешаем только если текущая роль 'user'
  )
  -- Запрещаем прямое изменение musician_status на 'approved'
  AND (
    musician_status = (SELECT musician_status FROM users WHERE id = auth.uid())
    OR (
      -- Разрешаем изменение только с 'none' на 'pending' или с 'rejected' на 'pending'
      (SELECT musician_status FROM users WHERE id = auth.uid()) IN ('none', 'rejected')
      AND musician_status = 'pending'
    )
  )
  -- Запрещаем изменение musician_approved_at (только админ может)
  AND (
    musician_approved_at = (SELECT musician_approved_at FROM users WHERE id = auth.uid())
    OR musician_approved_at IS NULL
  )
);

-- Политика: Пользователи могут создавать свои записи (при регистрации)
-- role и musician_status будут установлены в DEFAULT значения ('user' и 'none')
CREATE POLICY IF NOT EXISTS "Users can insert their own data"
ON users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ПРИМЕЧАНИЕ: Политики для админов должны быть настроены через сервисную роль
-- или через отдельные функции, которые проверяют роль через JWT токен на сервере.
-- Supabase RLS не имеет встроенной поддержки проверки кастомных ролей из таблицы users,
-- поэтому админские операции должны выполняться через серверные функции (Netlify Functions),
-- которые используют service_role_key для обхода RLS.

-- Комментарий
COMMENT ON POLICY "Users can read their own data" ON users IS 
  'Пользователи могут читать свои собственные данные';
COMMENT ON POLICY "Users can update their own data with restrictions" ON users IS 
  'Пользователи могут обновлять свои данные, но не могут напрямую менять role на musician или musician_status на approved';
COMMENT ON POLICY "Users can insert their own data" ON users IS 
  'Пользователи могут создавать свои записи при регистрации';

