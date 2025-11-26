# Как получить значения переменных окружения из Netlify

## Проблема

Переменные окружения в Netlify Dashboard скрыты (secret), и их нельзя скопировать. Но для локальной разработки нужны эти значения.

## Решение 1: Раскрыть переменные временно (рекомендуется)

1. Откройте Netlify Dashboard:
   https://app.netlify.com/sites/smolyanoechuchelko/settings/env

2. Для каждой переменной (`DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`):
   - Нажмите на переменную
   - Нажмите "Options" → "Edit"
   - **Временно снимите галочку "Secret"** (или "Hide value")
   - Скопируйте значение
   - **Верните галочку "Secret"** обратно
   - Сохраните

3. Заполните `.env` файл скопированными значениями:

   ```bash
   code .env
   ```

4. Вставьте значения:

   ```
   DATABASE_URL=скопированное_значение
   ENCRYPTION_KEY=скопированное_значение
   JWT_SECRET=скопированное_значение
   JWT_EXPIRES_IN=7d
   ```

5. Сохраните файл

## Решение 2: Установить переменные для dev контекста

1. Откройте Netlify Dashboard:
   https://app.netlify.com/sites/smolyanoechuchelko/settings/env

2. Для каждой переменной:
   - Нажмите на переменную
   - Нажмите "Options" → "Edit"
   - В разделе "Deploy context":
     - Найдите "Deploy Previews" или "Branch deploys"
     - Нажмите "Add value"
     - **Временно снимите галочку "Secret"** для Production значения
     - Скопируйте значение из Production
     - **Верните галочку "Secret"** обратно
     - Вставьте скопированное значение в "Deploy Previews" и "Branch deploys"
     - Сохраните

3. После этого `netlify dev` будет использовать эти переменные

## Решение 3: Если вы знаете значения

Если вы сами создавали эти переменные и помните значения:

1. Откройте `.env` файл:

   ```bash
   code .env
   ```

2. Заполните вручную:

   ```
   DATABASE_URL=ваше_значение
   ENCRYPTION_KEY=ваше_значение
   JWT_SECRET=ваше_значение
   JWT_EXPIRES_IN=7d
   ```

3. Сохраните файл

## После заполнения

1. Перезапустите сервер:

   ```bash
   npm run dev
   ```

2. Проверьте логи - должно быть:

   ```
   ◈ Injected .env file env var: DATABASE_URL
   ◈ Injected .env file env var: ENCRYPTION_KEY
   ```

3. Откройте `http://localhost:8888`

4. Проверьте, что ошибки `DATABASE_URL is not set!` исчезли
