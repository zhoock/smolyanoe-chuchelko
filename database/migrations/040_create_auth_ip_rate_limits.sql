-- Hourly IP rate limits for auth verification endpoints
CREATE TABLE IF NOT EXISTS auth_ip_rate_limits (
  ip_address VARCHAR(45) NOT NULL,
  bucket_key VARCHAR(64) NOT NULL,
  window_hour TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_address, bucket_key, window_hour)
);

CREATE INDEX IF NOT EXISTS idx_auth_ip_rate_limits_window_hour
  ON auth_ip_rate_limits (window_hour);

COMMENT ON TABLE auth_ip_rate_limits IS 'Hourly IP counters for auth abuse protection';
