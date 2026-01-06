-- Миграция: Установка site_name для владельца сайта
-- Дата: 2025

-- Обновляем site_name для пользователя zhoock@zhoock.ru
UPDATE users
SET site_name = 'Смоляное чучелко',
    updated_at = NOW()
WHERE email = 'zhoock@zhoock.ru' AND is_active = true;

-- Комментарий
COMMENT ON COLUMN users.site_name IS 'Название сайта/группы (Site/Band Name) из формы регистрации';

