-- Миграция: Добавление ролей и статусов музыканта
-- Дата: 2025

-- Добавляем поля для ролей и статусов
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'musician', 'admin')),
ADD COLUMN IF NOT EXISTS musician_status TEXT NOT NULL DEFAULT 'none' CHECK (musician_status IN ('none', 'pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS musician_reject_reason TEXT,
ADD COLUMN IF NOT EXISTS musician_applied_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS musician_approved_at TIMESTAMPTZ;

-- Добавляем поля для данных заявки музыканта
ALTER TABLE users
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_musician_status ON users(musician_status);
CREATE INDEX IF NOT EXISTS idx_users_musician_pending ON users(musician_status) WHERE musician_status = 'pending';

-- Комментарии
COMMENT ON COLUMN users.role IS 'Роль пользователя: user, musician, admin';
COMMENT ON COLUMN users.musician_status IS 'Статус заявки музыканта: none, pending, approved, rejected';
COMMENT ON COLUMN users.musician_reject_reason IS 'Причина отклонения заявки музыканта';
COMMENT ON COLUMN users.musician_applied_at IS 'Дата подачи заявки на статус музыканта';
COMMENT ON COLUMN users.musician_approved_at IS 'Дата одобрения заявки музыканта';
COMMENT ON COLUMN users.artist_name IS 'Название артиста/группы из заявки';
COMMENT ON COLUMN users.bio IS 'Биография артиста/группы';
COMMENT ON COLUMN users.links IS 'Ссылки на соцсети и другие ресурсы (JSONB массив)';

