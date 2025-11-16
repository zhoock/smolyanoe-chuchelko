-- Миграция: Создание таблицы для настроек платежей пользователей
-- Дата: 2024

-- Таблица для хранения настроек платежных систем пользователей
CREATE TABLE IF NOT EXISTS user_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('yookassa', 'stripe', 'paypal')),
  shop_id VARCHAR(255),
  secret_key_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  
  -- Уникальный индекс: один пользователь - одна платежная система
  UNIQUE(user_id, provider)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_payment_settings_user_id ON user_payment_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_settings_provider ON user_payment_settings(provider);
CREATE INDEX IF NOT EXISTS idx_user_payment_settings_is_active ON user_payment_settings(is_active);

-- Комментарии к таблице и колонкам
COMMENT ON TABLE user_payment_settings IS 'Настройки платежных систем для пользователей';
COMMENT ON COLUMN user_payment_settings.id IS 'Уникальный идентификатор настройки';
COMMENT ON COLUMN user_payment_settings.user_id IS 'ID пользователя';
COMMENT ON COLUMN user_payment_settings.provider IS 'Провайдер платежной системы (yookassa, stripe, paypal)';
COMMENT ON COLUMN user_payment_settings.shop_id IS 'ID магазина (shopId для ЮKassa)';
COMMENT ON COLUMN user_payment_settings.secret_key_encrypted IS 'Зашифрованный секретный ключ';
COMMENT ON COLUMN user_payment_settings.is_active IS 'Активна ли настройка';
COMMENT ON COLUMN user_payment_settings.created_at IS 'Дата создания';
COMMENT ON COLUMN user_payment_settings.updated_at IS 'Дата последнего обновления';
COMMENT ON COLUMN user_payment_settings.last_used_at IS 'Дата последнего использования';

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_payment_settings_updated_at
  BEFORE UPDATE ON user_payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

