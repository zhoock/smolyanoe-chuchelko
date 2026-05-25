-- Password reset fields for users.
--
-- We never store the plaintext reset token in the database. The bytes that
-- ship in the email are hashed with SHA-256 and only the hex digest is
-- persisted in `password_reset_token_hash`. A request that arrives at
-- /api/auth/reset-password is matched by hashing the supplied token and
-- comparing against the column.
--
-- After a successful reset (or after a token is used to set a new password)
-- all three columns are NULL'd out so the same link cannot be replayed.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash
  ON users (password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;

COMMENT ON COLUMN users.password_reset_token_hash IS
  'SHA-256 hex digest of the active password reset token (NULL when none).';
COMMENT ON COLUMN users.password_reset_expires_at IS
  'When the active password reset token expires (NULL when none).';
COMMENT ON COLUMN users.password_reset_requested_at IS
  'When the active password reset token was issued (NULL when none).';
