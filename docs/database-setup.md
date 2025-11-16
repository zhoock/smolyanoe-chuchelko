# Настройка базы данных для платежей

## Требования

1. **PostgreSQL** база данных (версия 12+)
2. **Переменные окружения** для подключения к БД
3. **Ключ шифрования** для secretKey

## Установка

### 1. Создание базы данных

Подключитесь к вашему PostgreSQL серверу и выполните SQL скрипт:

```bash
psql -U your_username -d your_database -f database/migrations/001_create_payment_settings.sql
```

Или выполните SQL команды вручную:

```sql
-- См. database/migrations/001_create_payment_settings.sql
```

### 2. Настройка переменных окружения в Netlify

В настройках проекта Netlify добавьте следующие переменные окружения:

```
# PostgreSQL подключение
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Ключ шифрования (генерируется один раз)
ENCRYPTION_KEY=your-32-byte-encryption-key-base64

# URL API ЮKassa (опционально)
YOOKASSA_API_URL=https://api.yookassa.ru/v3/payments
```

#### Генерация ключа шифрования

**Важно:** Используйте безопасный ключ шифрования!

```bash
# Генерация случайного ключа (32 байта в base64)
openssl rand -base64 32
```

Скопируйте результат и добавьте в `ENCRYPTION_KEY`.

**⚠️ ВАЖНО:**

- Ключ должен быть уникальным и безопасным
- Храните его в переменных окружения Netlify (НЕ в коде!)
- Не коммитьте ключ в Git
- Создайте отдельный ключ для каждого окружения (dev, staging, production)

### 3. Структура таблицы

Таблица `user_payment_settings` содержит:

- `id` - UUID первичный ключ
- `user_id` - ID пользователя (VARCHAR)
- `provider` - Провайдер ('yookassa', 'stripe', 'paypal')
- `shop_id` - ID магазина (shopId для ЮKassa)
- `secret_key_encrypted` - Зашифрованный секретный ключ (AES-256-GCM)
- `is_active` - Активна ли настройка
- `created_at` - Дата создания
- `updated_at` - Дата последнего обновления (автоматически)
- `last_used_at` - Дата последнего использования

## Безопасность

### Шифрование

- `secretKey` шифруется с использованием **AES-256-GCM**
- Ключ шифрования хранится в переменных окружения Netlify
- При чтении ключ автоматически расшифровывается

### Валидация

- При сохранении настроек выполняется **валидация через тестовый запрос к ЮKassa API**
- Создается тестовый платеж на 0.01 RUB для проверки credentials
- Некорректные credentials не сохраняются в БД

## Использование

### Сохранение настроек

```typescript
// POST /api/payment-settings
{
  "userId": "user-123",
  "provider": "yookassa",
  "shopId": "123456",
  "secretKey": "your-secret-key",
  "isActive": true
}
```

### Получение настроек

```typescript
// GET /api/payment-settings?userId=user-123&provider=yookassa
```

### Отключение платежной системы

```typescript
// DELETE /api/payment-settings?userId=user-123&provider=yookassa
```

## Миграции

Для добавления новых миграций создавайте файлы в `database/migrations/`:

```
database/
  migrations/
    001_create_payment_settings.sql
    002_add_index_on_user_id.sql
    ...
```

## Backup и восстановление

**Рекомендуется:**

- Регулярные автоматические бэкапы БД
- Тестирование восстановления из бэкапа
- Хранение бэкапов в отдельном безопасном месте

## Мониторинг

Отслеживайте:

- Количество активных настроек платежей
- Использование платежных систем (`last_used_at`)
- Ошибки подключения к БД
- Ошибки шифрования/расшифровки

## Troubleshooting

### Ошибка подключения к БД

1. Проверьте `DATABASE_URL` в переменных окружения Netlify
2. Убедитесь, что БД доступна из Netlify Functions
3. Проверьте SSL настройки (для production требуется SSL)

### Ошибка шифрования

1. Проверьте `ENCRYPTION_KEY` в переменных окружения
2. Убедитесь, что ключ правильной длины (32 байта в base64 = 44 символа)
3. **Внимание:** Если ключ изменится, существующие зашифрованные данные не смогут быть расшифрованы!

### Ошибка валидации ЮKassa

1. Проверьте правильность `shopId` и `secretKey`
2. Убедитесь, что аккаунт ЮKassa активен
3. Проверьте доступность API ЮKassa
