-- Миграция: Создание таблицы покупок
-- Дата: 2024

-- Таблица покупок (связь покупателя с купленными альбомами)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  album_id VARCHAR(255) NOT NULL, -- album_id из таблицы albums
  purchase_token UUID DEFAULT gen_random_uuid(), -- Уникальный токен для безопасных ссылок
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Опционально: срок действия доступа (NULL = бессрочно)
  download_count INTEGER DEFAULT 0, -- Счетчик скачиваний
  last_downloaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальность: один email - один альбом (предотвращает дубликаты)
  UNIQUE(customer_email, album_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_purchases_customer_email ON purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchases_album_id ON purchases(album_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_token ON purchases(purchase_token);
CREATE INDEX IF NOT EXISTS idx_purchases_order_id ON purchases(order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON purchases(purchased_at);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии
COMMENT ON TABLE purchases IS 'Покупки пользователей (связь email покупателя с альбомами)';
COMMENT ON COLUMN purchases.id IS 'Уникальный идентификатор покупки';
COMMENT ON COLUMN purchases.order_id IS 'Связь с заказом';
COMMENT ON COLUMN purchases.customer_email IS 'Email покупателя';
COMMENT ON COLUMN purchases.album_id IS 'ID альбома (из таблицы albums)';
COMMENT ON COLUMN purchases.purchase_token IS 'Уникальный токен для безопасных ссылок на скачивание';
COMMENT ON COLUMN purchases.purchased_at IS 'Дата и время покупки';
COMMENT ON COLUMN purchases.expires_at IS 'Срок действия доступа (NULL = бессрочно)';
COMMENT ON COLUMN purchases.download_count IS 'Количество скачиваний';
COMMENT ON COLUMN purchases.last_downloaded_at IS 'Дата последнего скачивания';


