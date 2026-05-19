-- Premium subscription payments (platform YooKassa) — separate from album orders/payments.

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'yookassa',
  provider_payment_id VARCHAR(255),
  status TEXT NOT NULL DEFAULT 'pending',
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
  plan TEXT NOT NULL DEFAULT 'archive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscription_payments_status_check
    CHECK (status IN ('pending', 'waiting_for_capture', 'succeeded', 'canceled', 'failed')),
  CONSTRAINT subscription_payments_provider_payment_unique
    UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_id ON subscription_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_provider_payment_id
  ON subscription_payments (provider, provider_payment_id);

CREATE TRIGGER update_subscription_payments_updated_at
  BEFORE UPDATE ON subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE subscription_payments IS 'Platform Premium checkout payments (YooKassa), not album orders';
