-- Обновление пароля для существующего пользователя
-- ВНИМАНИЕ: Замените 'ваш_email@example.com' на реальный email пользователя
-- Замените 'ваш_пароль' на желаемый пароль

UPDATE users 
SET password = '123123' 
WHERE email = 'zhoock@zhoock.com';

-- Пример: для пользователя zhoock@zhoock.ru
-- UPDATE users 
-- SET password = 'мой_пароль_123' 
-- WHERE email = 'zhoock@zhoock.ru';

