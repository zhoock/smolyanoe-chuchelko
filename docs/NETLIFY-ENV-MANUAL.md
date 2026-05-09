# Ручная настройка переменных окружения в Netlify

## 🔐 Почему ручная настройка?

Netlify Dashboard — это веб-интерфейс для управления вашими проектами. Настройка переменных окружения требует:

- Авторизации в вашем аккаунте Netlify
- Доступа к конкретному проекту
- Ручного ввода значений (для безопасности)

**Автоматизировать это нельзя**, так как это требует доступа к вашему личному аккаунту.

## 📝 Пошаговая инструкция

### Шаг 1: Войдите в Netlify Dashboard

1. Откройте https://app.netlify.com
2. Войдите в свой аккаунт
3. Выберите ваш проект (сайт)

### Шаг 2: Откройте настройки переменных окружения

**На главной странице проекта:**

1. В **левом меню** (vertical navigation bar) найдите пункт **"Project configuration"**
2. Нажмите на **"Project configuration"** (второй пункт ниже "Project overview")
3. В открывшемся меню или странице найдите раздел **"Environment variables"** или **"Environment"**
4. Нажмите на **"Environment variables"**

**Альтернативный путь:**

- Если вы видите кнопку **"Project configuration"** в карточке проекта — нажмите на неё

5. Нажмите кнопку **"Add a variable"** или **"Add variable"**

### Шаг 3: Добавьте переменные

Добавьте каждую переменную по очереди:

#### 1. DATABASE_URL

```
Key: DATABASE_URL
Value: postgresql://username:password@host:port/database?sslmode=require
```

**Где взять значение:**

- Если используете Supabase: **Project settings** → **Database** → **Connection string**
- Если используете Neon: **Dashboard** → **Connection string**
- Если локально: создайте свой строку подключения

**Важно:** Замените `username`, `password`, `host`, `port`, `database` на реальные значения!

#### 2. ENCRYPTION_KEY

```
Key: ENCRYPTION_KEY
Value: Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0=
```

**Где взять значение:**

- Запустите: `npm run generate-encryption-key`
- Скопируйте значение из вывода команды

**⚠️ ВАЖНО:** Используйте разные ключи для разных окружений (Production, Deploy previews, Branch deploys)!

#### 3. ЮKassa — только общие переменные (без глобального shop/secret)

Креды магазина продавцы сохраняют в ЛК сайта → БД (`user_payment_settings`). В Netlify **не обязательны** `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`; код их **не читает** для создания платежей.

При необходимости задайте:

```
Key: YOOKASSA_API_URL
Value: https://api.yookassa.ru/v3/payments
```

**Legacy (не использовать для новых проектов):** если переменные `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` уже есть в Netlify со старых инструкций, их наличие **не требуется** и может быть удалено без вреда tenant-only платежам.

### Шаг 4: Выберите контекст (Scope)

Для каждой переменной выберите, где она будет доступна:

- **Production** — только для production деплоев
- **Deploy previews** — для preview деплоев (Pull Requests)
- **Branch deploys** — для branch деплоев

**Рекомендация:**

- Для `DATABASE_URL` и `ENCRYPTION_KEY` — включите все нужные контексты
- Для `YOOKASSA_API_URL`, `YOOKASSA_RETURN_URL` — по необходимости тех же контекстов

### Шаг 5: Сохраните и передеплойте

1. Нажмите **Save** для каждой переменной
2. **ВАЖНО:** После изменения переменных окружения нужно передеплоить проект:
   - **Deploys** → **Trigger deploy** → **Deploy site**

## ✅ Проверка

После настройки переменных:

1. **Deploys** → **Functions** → **Logs**
2. Попробуйте создать платеж или сохранить настройки
3. Проверьте логи на наличие ошибок подключения к БД

Если ошибок нет — всё настроено правильно! ✅

## 🎯 Альтернатива: Netlify CLI

Если вы используете Netlify CLI локально, можно настроить через терминал:

```bash
# Установите Netlify CLI (если еще не установлен)
npm install -g netlify-cli

# Авторизуйтесь
netlify login

# Перейдите в директорию проекта
cd /path/to/your/project

# Добавьте переменные
netlify env:set DATABASE_URL "postgresql://user:pass@host:port/db" --context production
netlify env:set ENCRYPTION_KEY "Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0=" --context production
```

Но для этого все равно нужен доступ к вашему Netlify аккаунту через CLI.

## 🆘 Проблемы?

### Переменные не применяются

**Проблема:** Переменные окружения не работают после настройки

**Решение:**

1. Убедитесь, что переменные сохранены для нужного контекста
2. **Передеплойте проект** после изменения переменных
3. Проверьте, что нет опечаток в именах переменных (чувствительны к регистру!)

### Нет доступа к Netlify Dashboard

**Проблема:** Не можете войти в Netlify Dashboard

**Решение:**

- Восстановите доступ к аккаунту через email
- Обратитесь к владельцу проекта для добавления вас в команду
- Используйте Netlify CLI как альтернативу

## 📸 Скриншоты (для справки)

### Где найти Environment variables:

1. Netlify Dashboard → Ваш проект
2. **Site settings** (в верхнем меню)
3. **Environment variables** (в левом меню)

### Как добавить переменную:

1. Нажмите **Add a variable**
2. Введите **Key** (имя переменной)
3. Введите **Value** (значение)
4. Выберите **Scope** (контекст)
5. Нажмите **Save**

## 📚 Связанная документация

- [Быстрый старт](./SETUP-PAYMENTS.md)
- [Чеклист настройки](./setup-checklist.md)
- [Настройка базы данных](./database-setup.md)
