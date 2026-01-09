# Локальная разработка

## Быстрый старт

1. **Установите зависимости:**

   ```bash
   npm install
   ```

2. **Настройте переменные окружения:**

   **Вариант 1 (рекомендуется): Загрузить из Netlify**

   ```bash
   source scripts/load-netlify-env.sh
   ```

   **Вариант 2: Создать локальный `.env` файл**

   ```bash
   cp .env.example .env
   # Отредактируйте .env и заполните переменные вручную
   ```

3. **Запустите локальный сервер:**

   ```bash
   netlify dev
   ```

   Откройте в браузере: `http://localhost:8888`

## Структура

- **Webpack Dev Server** работает на порту **8080**
- **Netlify Dev** проксирует запросы на порту **8888**
- **Netlify Functions** обрабатывают API запросы на `http://localhost:8888/.netlify/functions/*`

## Переменные окружения

Обязательные переменные:

- `DATABASE_URL` - строка подключения к PostgreSQL (Supabase)
- `JWT_SECRET` - секретный ключ для JWT токенов
- `JWT_EXPIRES_IN` - время жизни JWT токена (например, "7d")

Опциональные:

- `NETLIFY_SITE_URL` - URL продакшн сайта (для проксирования API вместо локальных функций)
- `SUBDOMAIN_BASE_DOMAIN` / `VITE_SUBDOMAIN_BASE_DOMAIN` - базовый домен для пользовательских поддоменов (например, `smolyanoechuchelko.ru`)
- `ENABLE_SUBDOMAIN_MULTI_TENANCY` / `VITE_ENABLE_SUBDOMAIN_MULTI_TENANCY` - включает модель социальной сети как локально, так и в production
- `DATABASE_URL_STAGING` - строка подключения к отдельной staging-базе (используется локальными Netlify Functions)
- `NETLIFY_STAGING_URL` - staging-деплой фронтенда, куда проксируются API при `npm start`
- `USE_PROD_API` - если установить `true`, фронтенд будет отправлять запросы на продакшн (по умолчанию оставляем `false`)

### Поддомены и staging-окружение

Для работы в мультипользовательском режиме создайте или обновите `.env.local` и пропишите ключевые переменные:

```bash
SUBDOMAIN_BASE_DOMAIN=smolyanoechuchelko.ru
ENABLE_SUBDOMAIN_MULTI_TENANCY=true
DATABASE_URL_STAGING=postgres://user:password@staging-host:5432/database
NETLIFY_STAGING_URL=https://staging.smolyanoechuchelko.ru
USE_PROD_API=false
```

- `SUBDOMAIN_BASE_DOMAIN` сообщает приложениям основной домен, чтобы `username.example.ru` резолвился к нужному пользователю.
- `DATABASE_URL_STAGING` изолирует локальные изменения от боевой базы.
- `NETLIFY_STAGING_URL` позволяет фронтенду проксировать запросы на staging-функции, если вы запускаете только webpack dev server.
- `USE_PROD_API=true` используйте осознанно — только если нужен прямой доступ к продакшн API.

## Команды

- `npm start` - запустить только webpack dev server (без Netlify функций)
- `netlify dev` - запустить полный dev сервер с Netlify функциями
- `npm run build` - собрать production версию

## Проблемы и решения

### Админка не открывается локально

**Проблема:** После запуска `netlify dev` админка (`/dashboard/*`) не открывается или показывает ошибки.

**Решение:**

1. Убедитесь, что переменные окружения загружены:

   ```bash
   echo $DATABASE_URL
   echo $JWT_SECRET
   ```

2. Проверьте, что Netlify CLI установлен и авторизован:

   ```bash
   netlify --version
   netlify status
   ```

3. Если проект не связан с Netlify:

   ```bash
   netlify link
   ```

4. Перезапустите dev сервер:
   ```bash
   netlify dev
   ```

### API запросы возвращают ошибки

**Проблема:** API запросы к `/api/*` возвращают 404 или ошибки.

**Решение:**

1. Убедитесь, что `netlify dev` запущен (не просто `npm start`)
2. Проверьте, что переменные окружения загружены (особенно `DATABASE_URL`)
3. Проверьте логи в терминале, где запущен `netlify dev`

### Ошибка "DATABASE_URL is not set!"

**Проблема:** Netlify функции выдают ошибку о отсутствии `DATABASE_URL`.

**Решение:**

1. Загрузите переменные окружения:

   ```bash
   source scripts/load-netlify-env.sh
   ```

2. Или создайте `.env` файл с переменными

3. Убедитесь, что `.env` файл находится в корне проекта

4. Перезапустите `netlify dev`

## Разработка без Netlify Dev

Если вы хотите запустить только фронтенд без Netlify функций:

```bash
NETLIFY_STAGING_URL=https://staging.smolyanoechuchelko.ru npm start
```

Это запустит webpack dev server, который будет проксировать API запросы на staging. Если нужно сходить на продакшн, установите `USE_PROD_API=true`, но по умолчанию держите `false`, чтобы не создавать данные на продакшне.

## Проверка работы

1. Откройте `http://localhost:8888`
2. Перейдите на `/auth` и залогиньтесь
3. Перейдите на `/dashboard/albums` - должна открыться админка
4. Проверьте, что альбомы загружаются
