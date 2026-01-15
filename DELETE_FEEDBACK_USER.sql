-- Скрипт для удаления пользователя feedback@smolyanoechychelko.ru
-- Выполнить через psql или Supabase SQL Editor
-- 
-- Использование:
--   psql $DATABASE_URL -f DELETE_FEEDBACK_USER.sql
--   или выполнить в Supabase SQL Editor

-- Удаляем пользователя feedback@smolyanoechychelko.ru
-- CASCADE удалит все связанные данные (альбомы, треки, статьи, заказы и т.д.)
DELETE FROM users 
WHERE email = 'feedback@smolyanoechychelko.ru';

-- Проверяем, что пользователь удален
SELECT COUNT(*) as remaining_users FROM users WHERE email = 'feedback@smolyanoechychelko.ru';
-- Должно вернуть 0

-- Показываем оставшихся пользователей
SELECT id, email, name, is_active, created_at FROM users ORDER BY created_at;