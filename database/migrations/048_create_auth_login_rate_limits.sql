-- Login brute-force / credential-stuffing protection.
-- Two parallel buckets (rolling window + temporary lockout):
--   * bucket_type = 'ip'    : catches one IP trying many emails
--   * bucket_type = 'email' : catches many IPs trying one email (proxy rotation)
--
-- Only failed credential checks (unknown email / wrong password) increment a bucket.
-- Successful logins purge the email bucket (see netlify/functions/lib/login-rate-limit.ts).
CREATE TABLE IF NOT EXISTS auth_login_rate_limits (
  bucket_type VARCHAR(16) NOT NULL,
  bucket_key VARCHAR(255) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_type, bucket_key)
);

CREATE INDEX IF NOT EXISTS idx_auth_login_rate_limits_locked_until
  ON auth_login_rate_limits (locked_until)
  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_login_rate_limits_updated_at
  ON auth_login_rate_limits (updated_at);

COMMENT ON TABLE auth_login_rate_limits IS
  'Failure counters + temporary lockouts for /api/auth/login (IP and email buckets).';
COMMENT ON COLUMN auth_login_rate_limits.bucket_type IS 'ip | email';
COMMENT ON COLUMN auth_login_rate_limits.bucket_key IS 'Normalized IP address or lowercased email';
COMMENT ON COLUMN auth_login_rate_limits.window_start IS 'Start of the current counting window';
COMMENT ON COLUMN auth_login_rate_limits.failed_count IS 'Failed attempts within the current window';
COMMENT ON COLUMN auth_login_rate_limits.locked_until IS 'When set and > NOW(), bucket is in temporary lockout';
