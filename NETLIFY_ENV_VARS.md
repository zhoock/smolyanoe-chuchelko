# Переменные окружения для Netlify

## Обязательные переменные

### База данных (Supabase)

- `DATABASE_URL` - Connection string для PostgreSQL/Supabase
  - Формат: `postgresql://user:password@host:port/database?sslmode=require`
  - Для Supabase Pro: используйте connection string из настроек проекта

### GitHub API (для обновления JSON файлов)

- `GITHUB_TOKEN` - Personal Access Token с правами на запись в репозиторий
- `GITHUB_OWNER` - Владелец репозитория (по умолчанию: `zhoock`)
- `GITHUB_REPO` - Название репозитория (по умолчанию: `smolyanoe-chuchelko`)
- `GITHUB_BRANCH` - Ветка для коммитов (по умолчанию: `main`)

### JWT (для аутентификации)

- `JWT_SECRET` - Секретный ключ для подписи JWT токенов
- `JWT_EXPIRES_IN` - Время жизни токена (по умолчанию: `7d`)

### Шифрование

- `ENCRYPTION_KEY` - Ключ для шифрования чувствительных данных (32 байта в hex формате)

### Email (Resend)

- `RESEND_API_KEY` - API ключ для отправки email через Resend
  - Получить можно в [Resend Dashboard](https://resend.com/api-keys)
  - Используется для отправки писем о покупках покупателям

### Supabase Storage (опционально)

- `SUPABASE_URL` или `VITE_SUPABASE_URL` - URL вашего Supabase проекта
  - Используется для загрузки файлов и проксирования изображений
- `VITE_USE_SUPABASE_STORAGE` - Включить использование Supabase Storage для медиафайлов
  - Значение: `true` (строка) - использовать Supabase Storage
  - Значение: `false` или не установлено - использовать локальные файлы
  - **Рекомендация:** Установите `true` для всех контекстов (Production, Deploy Previews, Branch deploys, Local development)

## Опциональные переменные

### YooKassa (для платежей)

- `YOOKASSA_SHOP_ID` - ID магазина в YooKassa
- `YOOKASSA_SECRET_KEY` - Секретный ключ YooKassa
- `YOOKASSA_API_URL` - URL API YooKassa (по умолчанию: `https://api.yookassa.ru/v3/payments`)

## Как установить переменные в Netlify

1. Перейдите в настройки вашего сайта в Netlify
2. Откройте раздел **Site settings** → **Environment variables**
3. Добавьте все переменные из списка выше
4. Для переменных с чувствительными данными (токены, ключи) используйте **Sensitive** флаг

## Проверка переменных

После установки переменных можно проверить их наличие через Netlify CLI:

```bash
netlify env:list
```

Или через скрипт:

```bash
npm run test-netlify-env
```
