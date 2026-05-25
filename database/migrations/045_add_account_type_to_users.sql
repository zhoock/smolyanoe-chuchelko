-- Account type: listener (music library) vs artist (full CMS).
-- Separate from platform role (user | admin) in users.role.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) NOT NULL DEFAULT 'artist';

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_account_type_check;

ALTER TABLE users
ADD CONSTRAINT users_account_type_check
CHECK (account_type IN ('listener', 'artist'));

COMMENT ON COLUMN users.account_type IS 'Тип аккаунта: listener | artist (не путать с users.role admin)';

-- Existing accounts were artist-capable (site_name, public_slug, releases).
UPDATE users
SET account_type = 'artist'
WHERE account_type IS NULL OR account_type = '';

CREATE INDEX IF NOT EXISTS idx_users_account_type ON users (account_type);
