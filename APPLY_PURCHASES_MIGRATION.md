# Применение миграций для таблиц orders и purchases

## Проблема

Если вы видите ошибку "Failed to get purchases" на странице "Мои покупки", скорее всего не применены миграции для создания таблиц `orders` и `purchases`.

## Решение

### Шаг 1: Применить миграцию 020 (orders и payments)

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**
4. Скопируйте весь SQL код из файла `database/migrations/020_create_orders_and_payments.sql`
5. Вставьте в SQL Editor
6. Нажмите кнопку **Run** для выполнения запроса

### Шаг 2: Применить миграцию 021 (purchases)

1. В том же SQL Editor
2. Скопируйте весь SQL код из файла `database/migrations/021_create_purchases.sql`
3. Вставьте в SQL Editor
4. Нажмите кнопку **Run** для выполнения запроса

### Проверка

После выполнения обеих миграций проверьте, что таблицы созданы:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payments', 'webhook_events', 'purchases');
```

Должны вернуться 4 строки: `orders`, `payments`, `webhook_events`, `purchases`

### Альтернативный способ: через скрипт

Если у вас настроен `DATABASE_URL`:

```bash
# Установите DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Примените миграции через скрипт
npx tsx scripts/apply-sql-file.ts database/migrations/020_create_orders_and_payments.sql
npx tsx scripts/apply-sql-file.ts database/migrations/021_create_purchases.sql
```

## После применения миграций

1. ✅ Таблица `purchases` будет создана
2. ✅ Страница "Мои покупки" будет работать
3. ✅ Покупки будут сохраняться после успешной оплаты
