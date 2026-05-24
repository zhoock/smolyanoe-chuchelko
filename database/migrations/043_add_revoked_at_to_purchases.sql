-- Migration: Soft-revoke purchases (user removes from library without deleting row)
-- Date: 2026

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS revoked_by_user UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_active_user
  ON purchases(user_id)
  WHERE revoked_at IS NULL;

COMMENT ON COLUMN purchases.revoked_at IS 'When set, purchase is hidden from library and access checks';
COMMENT ON COLUMN purchases.revoked_by_user IS 'Account that revoked this purchase from their library';
