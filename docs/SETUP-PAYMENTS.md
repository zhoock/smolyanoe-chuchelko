# Быстрый старт: Настройка платежной системы

## 🚀 Быстрая настройка (5 минут)

### 1. Генерация ключа шифрования

```bash
npm run generate-encryption-key
```

**Сохраните вывод:** `ENCRYPTION_KEY=xxx...`

### 2. Настройка переменных окружения

**Для локальной разработки:**
Создайте файл `.env` (на основе `.env.example`):

```bash
cp .env.example .env
# Отредактируйте .env и добавьте ваши значения
```

**Для Netlify:**

**⚠️ Это требует ручной настройки в веб-интерфейсе Netlify**

📖 **Пошаговая инструкция:** [NETLIFY-QUICK-START.md](./NETLIFY-QUICK-START.md) (быстрый старт)

**Кратко:**

1. В левом меню нажмите **"Project configuration"**
2. Выберите **"Environment variables"**
3. Нажмите **"Add a variable"** и добавьте переменные (см. список ниже)
4. После добавления переменных **передеплойте проект** (Deploys → Trigger deploy)

**Подробная инструкция:** [NETLIFY-ENV-MANUAL.md](./NETLIFY-ENV-MANUAL.md)

### 3. Создание базы данных

Подключитесь к PostgreSQL и создайте БД:

```sql
CREATE DATABASE payment_db;
```

### 4. Выполнение миграций

```bash
export DATABASE_URL="postgresql://user:pass@host:port/payment_db"
npm run migrate
```

### 5. Тестирование

```bash
export DATABASE_URL="postgresql://user:pass@host:port/payment_db"
export ENCRYPTION_KEY="your-key-from-step-1"
npm run test-db
```

## 📋 Переменные окружения для Netlify

| Переменная         | Обязательно | Пример                                         | Описание                                    |
| ------------------ | ----------- | ---------------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`     | ✅ Да       | `postgresql://user:pass@host:port/db`          | Строка подключения к PostgreSQL             |
| `ENCRYPTION_KEY`   | ✅ Да       | `Vo9TISlSpeukILKP3HgkJBvUvyFAnFP/u56rdqKzKZ0=` | Ключ шифрования (из шага 1)                 |
| `YOOKASSA_API_URL` | ❌ Нет      | `https://api.yookassa.ru/v3/payments`          | URL API (по умолчанию совпадает с примером) |

ЮKassa **shopId / secret продавца** — в ЛК сайта → БД, **не** в Netlify ENV. Переменные **`YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY`** приложение **не использует** (можно полностью не задавать).

**📖 Подробная инструкция:** [NETLIFY-ENV-SETUP.md](./NETLIFY-ENV-SETUP.md)

## ✅ Чеклист настройки

- [ ] Ключ шифрования сгенерирован (`npm run generate-encryption-key`)
- [ ] PostgreSQL база данных создана
- [ ] `DATABASE_URL` настроен (локально и в Netlify)
- [ ] `ENCRYPTION_KEY` настроен (в Netlify)
- [ ] Миграции выполнены (`npm run migrate`)
- [ ] Тест подключения успешен (`npm run test-db`)
- [ ] Webhook URL настроен в ЮKassa Dashboard
- [ ] Артист с тестом оплаты подключил ЮKassa в разделе настроек сайта (креды попали в `user_payment_settings`)
- [ ] Тестовый платеж проходит успешно

## 📚 Подробная документация

- [Чеклист настройки](./setup-checklist.md) - пошаговая инструкция
- [Настройка базы данных](./database-setup.md) - детали работы с БД
- [Архитектура платежей](./payment-architecture.md) - архитектура системы
- [Интеграция ЮKassa](./yookassa-integration.md) - настройка ЮKassa

## 🔧 Доступные команды

```bash
# Генерация ключа шифрования
npm run generate-encryption-key

# Выполнение миграций БД
npm run migrate

# Тестирование подключения к БД
npm run test-db
```

## 🆘 Проблемы?

См. раздел **Troubleshooting** в [setup-checklist.md](./setup-checklist.md)
