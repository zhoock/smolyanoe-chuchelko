-- Track last verification email send for server-side resend cooldown
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN users.verification_email_sent_at IS 'Timestamp of last verification email send (cooldown enforcement)';
