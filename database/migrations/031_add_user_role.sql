-- Роль пользователя для проверки прав (например admin) без привязки к email
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';

COMMENT ON COLUMN users.role IS 'Уровень доступа: user | admin';

-- Владелец публичного сайта по умолчанию получает admin (один такой пользователь по бизнес-правилам)
UPDATE users
SET role = 'admin'
WHERE is_default_public_site = true
  AND is_active = true;
