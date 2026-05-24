-- Migration: Prepare session-based purchase ownership (nullable user_id)
-- Date: 2026

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);

COMMENT ON COLUMN purchases.user_id IS 'Account owner for session-based library. NULL until linked via checkout or claim flow';

-- Backfill: link purchases where checkout email matches a user account
UPDATE purchases p
SET user_id = u.id
FROM users u
WHERE p.user_id IS NULL
  AND LOWER(TRIM(p.customer_email)) = LOWER(TRIM(u.email));
