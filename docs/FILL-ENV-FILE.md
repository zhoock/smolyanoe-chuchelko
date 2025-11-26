# Как заполнить .env файл

## Проблема

Переменные окружения в Netlify Dashboard скрыты (secret), и их нельзя скопировать. Но Netlify Dev нужны эти переменные для работы функций.

## Решение

### Вариант 1: Заполнить .env вручную (если знаете значения)

1. Откройте файл `.env` в корне проекта:

   ```bash
   code .env
   # или
   nano .env
   ```

2. Заполните переменные реальными значениями:

   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   ENCRYPTION_KEY=ваш-полный-ключ-шифрования
   JWT_SECRET=ваш-полный-jwt-секрет
   JWT_EXPIRES_IN=7d
   ```

3. Сохраните файл

4. Перезапустите сервер:
   ```bash
   npm run dev
   ```

### Вариант 2: Установить переменные для dev контекста в Netlify Dashboard

1. Откройте: https://app.netlify.com/sites/YOUR-SITE/settings/env

2. Для каждой переменной (`DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`):
   - Нажмите на переменную
   - Нажмите "Options" → "Edit"
   - В разделе "Deploy context" добавьте значение для:
     - "Deploy Previews"
     - "Branch deploys"
   - Используйте то же значение, что и в Production (скопируйте из Production, если можете)

3. После этого `netlify dev` (без `--live`) будет использовать эти переменные

### Вариант 3: Использовать production переменные через --live

Если вы используете `netlify dev --live`, он автоматически использует production переменные, но:

- Открывается live URL вместо localhost:8888
- Может быть медленнее

## Проверка

После заполнения `.env` или настройки переменных в Dashboard:

1. Перезапустите сервер: `npm run dev`
2. Проверьте логи - должно быть:
   ```
   ◈ Injected .env file env var: DATABASE_URL
   ◈ Injected .env file env var: ENCRYPTION_KEY
   ```
3. Откройте `http://localhost:8888` (не live URL!)
4. Проверьте, что ошибки `DATABASE_URL is not set!` исчезли
