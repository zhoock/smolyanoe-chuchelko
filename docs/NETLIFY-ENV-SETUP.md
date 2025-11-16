# Настройка переменных окружения в Netlify

## 📋 Быстрая инструкция

### Способ 1: Через Netlify Dashboard (GUI)

1. Откройте [Netlify Dashboard](https://app.netlify.com)
2. Выберите ваш проект
3. Перейдите: **Site settings** → **Environment variables**
4. Нажмите **Add a variable** и добавьте следующие переменные:

#### Обязательные переменные:

```
DATABASE_URL = postgresql://username:password@host:port/database?sslmode=require
ENCRYPTION_KEY = Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0=
```

#### Опциональные переменные (для fallback аккаунта платформы):

```
YOOKASSA_SHOP_ID = ваш_shop_id
YOOKASSA_SECRET_KEY = ваш_secret_key
YOOKASSA_API_URL = https://api.yookassa.ru/v3/payments
```

5. Нажмите **Save**

### Способ 2: Через Netlify CLI

```bash
# Установите Netlify CLI (если еще не установлен)
npm install -g netlify-cli

# Авторизуйтесь
netlify login

# Добавьте переменные окружения
netlify env:set DATABASE_URL "postgresql://user:pass@host:port/db" --context production
netlify env:set ENCRYPTION_KEY "Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0=" --context production
netlify env:set YOOKASSA_SHOP_ID "ваш_shop_id" --context production
netlify env:set YOOKASSA_SECRET_KEY "ваш_secret_key" --context production
```

## 🔍 Проверка переменных

### Через Dashboard:

1. **Site settings** → **Environment variables**
2. Убедитесь, что все переменные отображаются правильно

### Через CLI:

```bash
netlify env:list
```

## 📝 Примеры значений

### DATABASE_URL

**Supabase:**

```
postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

**Neon:**

```
postgresql://user:pass@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Локально (для разработки):**

```
postgresql://postgres:password@localhost:5432/payment_db
```

### ENCRYPTION_KEY

Сгенерируйте через:

```bash
npm run generate-encryption-key
```

**Формат:** base64 строка (44 символа)

**Пример:**

```
Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0=
```

## ⚠️ Важно

1. **Разные окружения:** Используйте разные ключи для Production, Deploy previews и Branch deploys
2. **Безопасность:** Никогда не коммитьте переменные окружения в Git
3. **Fallback:** `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` нужны только если у пользователей нет индивидуальных аккаунтов
4. **Обновление:** После изменения переменных окружения нужно передеплоить проект

## 🔄 После настройки

1. **Передеплойте проект:**

   ```bash
   netlify deploy --prod
   ```

   Или через Dashboard: **Deploys** → **Trigger deploy** → **Deploy site**

2. **Проверьте логи:**
   - **Functions** → **Logs**
   - Убедитесь, что нет ошибок подключения к БД

## 🆘 Troubleshooting

### Переменные не работают

**Проблема:** Переменные окружения не применяются

**Решение:**

- Убедитесь, что переменные сохранены для нужного контекста (Production/Deploy previews/Branch deploys)
- Передеплойте проект после изменения переменных
- Проверьте синтаксис (нет ли лишних пробелов, кавычек)

### Ошибка подключения к БД

**Проблема:** `Error: connect ECONNREFUSED`

**Решение:**

- Проверьте правильность `DATABASE_URL`
- Убедитесь, что БД доступна из интернета (для production)
- Проверьте firewall правила
- Для Supabase/Neon убедитесь, что включен SSL (`sslmode=require`)
