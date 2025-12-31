-- Проверка текущего пароля в БД
-- Замените 'ваш_email@example.com' на ваш email

SELECT id, email, password, 
       CASE WHEN password IS NULL THEN 'NULL' ELSE 'Есть значение' END as password_status,
       LENGTH(password) as password_length
FROM users 
WHERE email = 'zhoock@zhoock.ru';

-- Или для всех пользователей:
-- SELECT id, email, password, LENGTH(password) as password_length
-- FROM users 
-- WHERE is_active = true;

