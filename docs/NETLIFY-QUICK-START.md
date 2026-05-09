# 🚀 Быстрая настройка переменных в Netlify (пошагово)

## 📍 Вы находитесь на странице "Project overview"

### Шаг 1: Перейдите в настройки проекта

**В левом меню (вертикальная панель слева):**

1. Найдите пункт **"Project configuration"**
   - Это второй пункт ниже "Project overview"
   - Иконка с шестерёнкой ⚙️ или текст "Project configuration"

2. **Нажмите** на **"Project configuration"**

### Шаг 2: Найдите раздел "Environment variables"

После перехода в "Project configuration" вы увидите настройки проекта.

1. В **левом подменю** (внутри раздела "Project configuration") найдите:
   - **"Environment variables"**
   - или **"Environment"** → **"Variables"**

2. **Нажмите** на **"Environment variables"**

### Шаг 3: Добавьте переменные

На странице "Environment variables" вы увидите список переменных (пока пустой).

1. Нажмите кнопку **"Add a variable"** или **"Add variable"** (обычно вверху справа)

2. Появится форма для добавления переменной:
   - **Key** (Имя переменной): введите `DATABASE_URL`
   - **Value** (Значение): вставьте строку подключения к PostgreSQL
   - **Scope** (Область применения): выберите **Production** (или все, что нужно)

3. Нажмите **"Save"** или **"Add variable"**

4. **Повторите** для `ENCRYPTION_KEY` и при необходимости `YOOKASSA_API_URL`.

   **Не нужно добавлять** `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` для оплаты: креды хранятся в БД у каждого артиста (legacy ключи можно оставить пустыми или удалить).

### Шаг 4: Передеплойте проект

**ВАЖНО:** После добавления переменных окружения нужно передеплоить проект!

1. Вернитесь в **"Project overview"** (нажмите на него в левом меню)
2. Найдите раздел **"Production deploys"**
3. Нажмите кнопку **"Trigger deploy"** → **"Deploy site"**
   - Или вверху страницы найдите кнопку **"Deploys"** → **"Trigger deploy"**

## 📝 Быстрая справка: Какие переменные добавлять

### Обязательные (добавьте обе):

```
Key: DATABASE_URL
Value: postgresql://username:password@host:port/database?sslmode=require
Scope: Production (или все)
```

```
Key: ENCRYPTION_KEY
Value: Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0= (ваш ключ из npm run generate-encryption-key)
Scope: Production (или все)
```

### Опциональные (общие параметры API)

```
Key: YOOKASSA_API_URL
Value: https://api.yookassa.ru/v3/payments
Scope: Production
```

**Legacy:** переменные `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` кодом платежей **не используются** и не нужны для tenant-only режима.

## 🎯 Визуальный путь

```
Netlify Dashboard
  └─ Projects / smolyanoechuchelko.ru (вы здесь!)
      └─ Project overview (текущая страница)
          └─ Левое меню:
              └─ [🟢] Project overview (активна)
              └─ [⚙️] Project configuration ← НАЖМИТЕ СЮДА
                  └─ В подменю:
                      └─ Environment variables ← НАЖМИТЕ СЮДА
                          └─ Add a variable ← НАЖМИТЕ СЮДА
```

## ✅ После настройки

1. ✅ Переменные добавлены
2. ✅ Проект передеплоен
3. ✅ Проверьте логи: **Deploys** → **Functions** → **Logs**

## 🆘 Не можете найти?

Если не видите "Environment variables" в "Project configuration":

1. Попробуйте **"Site settings"** в верхнем меню
2. Затем **"Environment variables"** в левом меню
3. Или используйте поиск в интерфейсе Netlify: введите "environment"

## 📚 Полная инструкция

См. [NETLIFY-ENV-MANUAL.md](./NETLIFY-ENV-MANUAL.md) для подробной инструкции со всеми деталями.
