-- Подписки платформы: premium state, сроки, лимиты слотов archive.
-- Archive (какие артисты открыты) — отдельная система; при истечении подписки archive не трогаем.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  plan TEXT NOT NULL,
  slots_limit INTEGER NOT NULL DEFAULT 3,
  provider TEXT,
  provider_subscription_id TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'canceled', 'expired', 'trial', 'paused'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions (expires_at);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE subscriptions IS 'Подписки пользователей: premium state, сроки, лимит слотов archive';
COMMENT ON COLUMN subscriptions.status IS 'active | canceled | expired | trial | paused';
COMMENT ON COLUMN subscriptions.plan IS 'Идентификатор тарифного плана';
COMMENT ON COLUMN subscriptions.slots_limit IS 'Макс. число артистов в archive (по умолчанию 3)';
