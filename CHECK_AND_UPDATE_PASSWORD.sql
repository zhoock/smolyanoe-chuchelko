-- Проверка и обновление пароля пользователя
-- Этот скрипт сначала проверит, какой email есть в базе, а затем обновит пароль

-- 1. Сначала проверим, какие пользователи есть в базе и есть ли у них пароль
SELECT id, email, name, 
       CASE WHEN password IS NULL THEN 'NULL' ELSE 'Есть пароль' END as password_status,
       LENGTH(password) as password_length
FROM users 
WHERE is_active = true;

-- 2. Проверим конкретного пользователя (замените email на нужный)
SELECT email, password, 
       CASE WHEN password IS NULL THEN 'NULL' ELSE password END as password_value,
       LENGTH(password) as password_length
FROM users 
WHERE email LIKE '%zhoock%' OR email LIKE '%zhook%';

-- 3. Обновление пароля (раскомментируйте и замените email на правильный)
-- UPDATE users 
-- SET password = '123123' 
-- WHERE email = 'zhook@zhoock.ru';  -- Проверьте правильный email из шага 1

-- 4. Проверка после обновления (замените email на правильный)
-- SELECT email, password, LENGTH(password) as password_length
-- FROM users 
-- WHERE email = 'zhook@zhoock.ru';

