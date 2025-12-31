# Применение миграции для создания таблиц orders, payments и webhook_events

## Способ 1: Через Supabase Dashboard (рекомендуется)

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**
4. Скопируйте весь SQL код из файла `database/migrations/020_create_orders_and_payments.sql`
5. Вставьте в SQL Editor
6. Нажмите кнопку **Run** для выполнения запроса

**Важно:** Если вы уже пытались выполнить миграцию и получили ошибку о несовместимости типов, сначала удалите частично созданные таблицы:

```sql
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
```

Затем выполните миграцию заново.

**Проверка:**
После выполнения проверьте, что таблицы созданы:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payments', 'webhook_events');
```

Должны вернуться 3 строки: `orders`, `payments`, `webhook_events`

## Способ 2: Через скрипт миграции (автоматически)

Если у вас настроен `DATABASE_URL`, можно выполнить все миграции автоматически:

```bash
# Установите DATABASE_URL (если еще не установлен)
export DATABASE_URL="postgresql://user:password@host:port/database"

# Выполните миграции
npm run migrate
```

Скрипт автоматически:

- Найдет все миграции в `database/migrations/`
- Проверит, какие уже выполнены
- Выполнит только новые миграции
- Отметит их как выполненные

## Способ 3: Через psql (если есть прямой доступ к БД)

```bash
psql $DATABASE_URL -f database/migrations/020_create_orders_and_payments.sql
```

Или если DATABASE_URL не установлен:

```bash
psql -h your-host -U your-user -d your-database -f database/migrations/020_create_orders_and_payments.sql
```

## Что создаст миграция

Миграция создаст 3 таблицы:

1. **`orders`** - заказы пользователей
   - Хранит информацию о заказах (ID, статус, сумма, клиент, дата оплаты)
   - Связь с пользователями через `user_id`

2. **`payments`** - детальная история платежей
   - Хранит информацию о каждом платеже от провайдера
   - Связь с заказами через `order_id`
   - Хранит последнее событие от провайдера для отладки

3. **`webhook_events`** - обработанные webhook события
   - Обеспечивает идемпотентность (не обрабатывает одно событие дважды)
   - Хранит историю всех обработанных webhook'ов

## После применения миграции

1. ✅ Таблицы готовы для работы с оплатой
2. ✅ Можно тестировать создание платежей
3. ✅ Webhook'и будут корректно обрабатываться

## Проверка работы

После применения миграции можно проверить через SQL:

```sql
-- Проверить структуру таблиц
\d orders
\d payments
\d webhook_events

-- Проверить, что таблицы пустые (для нового проекта это нормально)
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM payments;
SELECT COUNT(*) FROM webhook_events;
```
