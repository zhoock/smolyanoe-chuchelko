# Чеклист настройки платежной системы

Пошаговая инструкция по настройке всех компонентов платежной системы.

## ✅ Шаг 1: Генерация ключа шифрования

```bash
npm run generate-encryption-key
```

**Результат:** Вы получите строку вида `ENCRYPTION_KEY=xxx...`

**Важно:** Сохраните этот ключ в безопасном месте!

## ✅ Шаг 2: Настройка PostgreSQL базы данных

### 2.1. Создание базы данных

Подключитесь к PostgreSQL и создайте базу данных:

```sql
CREATE DATABASE your_database_name;
```

### 2.2. Получение DATABASE_URL

Сформируйте строку подключения:

```
postgresql://username:password@host:port/database_name?sslmode=require
```

**Примеры:**

- Локально: `postgresql://postgres:password@localhost:5432/payment_db`
- Supabase: `postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres`
- Neon: `postgresql://user:pass@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

## ✅ Шаг 3: Выполнение миграций

### 3.1. Настройка переменной окружения

```bash
export DATABASE_URL="postgresql://username:password@host:port/database"
```

### 3.2. Запуск миграций

```bash
npm run migrate
```

**Результат:**

```
🚀 Starting database migrations...
✅ Database connection successful
📋 Found 1 migration(s)
📝 Running migration: 001_create_payment_settings.sql
✅ Migration 001_create_payment_settings.sql completed successfully

✨ Migration completed!
   Executed: 1
   Skipped: 0
   Total: 1
```

## ✅ Шаг 4: Настройка переменных окружения в Netlify

1. Откройте **Netlify Dashboard** → Ваш проект → **Site settings** → **Environment variables**

2. Добавьте следующие переменные:

| Переменная         | Значение                              | Описание                                        |
| ------------------ | ------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`     | `postgresql://...`                    | Строка подключения к PostgreSQL                 |
| `ENCRYPTION_KEY`   | `xxx...` (из шага 1)                  | Ключ шифрования для `secret_key_encrypted` в БД |
| `YOOKASSA_API_URL` | `https://api.yookassa.ru/v3/payments` | URL API ЮKassa (опционально)                    |

ЮKassa **shopId и secret продавца** задаются через UI настройки платежей и сохраняются в БД. Глобальные **`YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY`** для этого приложения не нужны (legacy).

3. Нажмите **Save**

**Важно:**

- Используйте разные значения для разных окружений (Production, Deploy previews, Branch deploys)
- Не коммитьте эти переменные в Git!

## ✅ Шаг 5: Тестирование подключения к БД

### 5.1. Локальное тестирование

```bash
export DATABASE_URL="postgresql://username:password@host:port/database"
export ENCRYPTION_KEY="your-key-from-step-1"
npm run test-db
```

**Ожидаемый результат:**

```
🔍 Testing database connection...
✅ Connected to PostgreSQL: PostgreSQL 15.x
✅ Table user_payment_settings exists
✅ Encryption/decryption working correctly
✨ All tests completed successfully!
```

### 5.2. Тестирование через Netlify Functions

После деплоя проверьте логи Netlify Functions:

1. **Netlify Dashboard** → Ваш проект → **Functions** → **Logs**
2. Попробуйте создать настройки платежей через API
3. Проверьте, что нет ошибок подключения к БД

## ✅ Шаг 6: Проверка работы платежей

### 6.1. Тест через UI

1. Откройте страницу с формой покупки
2. Перейдите к шагу "Payment"
3. Введите данные карты
4. Нажмите "Pay"
5. Должно произойти перенаправление на страницу оплаты ЮKassa

### 6.2. Проверка логов

**Netlify Dashboard** → **Functions** → **Logs** → проверьте:

- ✅ `create-payment` - создание платежей
- ✅ `payment-settings` - сохранение настроек
- ✅ `payment-webhook` - обработка уведомлений от ЮKassa

## ✅ Шаг 7: Настройка Webhook от ЮKassa

1. Откройте **ЮKassa Dashboard** → **Настройки** → **HTTP-уведомления**
2. Добавьте URL:
   ```
   https://your-site.netlify.app/.netlify/functions/payment-webhook
   ```
3. Выберите события:
   - ✅ `payment.succeeded` - Платеж успешно завершен
   - ✅ `payment.canceled` - Платеж отменен

## 🔍 Проверка работоспособности

### Чеклист:

- [ ] База данных создана и доступна
- [ ] Миграции выполнены успешно
- [ ] Таблица `user_payment_settings` существует
- [ ] Переменные окружения настроены в Netlify
- [ ] Ключ шифрования сгенерирован и настроен
- [ ] Тест подключения к БД проходит успешно
- [ ] Тест шифрования/расшифровки работает
- [ ] Webhook URL настроен в ЮKassa
- [ ] Тестовый платеж проходит успешно

## 🆘 Troubleshooting

### Ошибка подключения к БД

```
❌ Error: connect ECONNREFUSED
```

**Решение:**

- Проверьте `DATABASE_URL`
- Убедитесь, что БД доступна из интернета (для Netlify)
- Проверьте firewall правила

### Ошибка шифрования

```
❌ Decryption failed
```

**Решение:**

- Убедитесь, что `ENCRYPTION_KEY` одинаковый для шифрования и расшифровки
- Ключ должен быть в формате base64 (44 символа)
- Не меняйте ключ после первого использования!

### Ошибка валидации ЮKassa

```
❌ Invalid YooKassa credentials
```

**Решение:**

- Проверьте правильность `shopId` и `secretKey`
- Убедитесь, что аккаунт ЮKassa активен
- Проверьте, что используется правильный API URL (test/production)

## 📚 Дополнительная документация

- [Архитектура платежной системы](./payment-architecture.md)
- [Интеграция с ЮKassa](./yookassa-integration.md)
- [Настройка базы данных](./database-setup.md)
