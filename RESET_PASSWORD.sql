-- Временный сброс пароля для восстановления доступа
-- ВНИМАНИЕ: Замените 'ваш_новый_пароль' на желаемый пароль
-- Замените 'ваш_email@example.com' на ваш email

-- Пример: установить пароль '12345678' для пользователя zhoock@zhoock.ru
-- UPDATE users 
-- SET password_hash = '$2a$10$YourHashedPasswordHere'  -- Нужен bcrypt хеш
-- WHERE email = 'zhoock@zhoock.ru';

-- Более простой способ через SQL (если есть функция для bcrypt в PostgreSQL):
-- Но лучше использовать API для этого

-- Проверка текущего пользователя и его пароля
SELECT id, email, 
       CASE WHEN password_hash IS NULL THEN 'NULL' ELSE 'Есть хеш' END as password_status
FROM users 
WHERE email LIKE '%zhoock%';

