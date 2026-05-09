# ✅ Проверка настройки переменных окружения в Netlify

## 🎯 Цель проверки

Убедиться, что:

1. ✅ Переменные окружения добавлены правильно
2. ✅ Netlify Functions могут их использовать
3. ✅ Подключение к базе данных работает
4. ✅ Шифрование работает корректно
5. ✅ Платежная система готова к работе

## 📋 Чеклист проверки

### ✅ Шаг 1: Проверка переменных в Netlify Dashboard

1. Откройте https://app.netlify.com
2. Выберите проект **smolyanoechuchelko**
3. Перейдите: **Project configuration** → **Environment variables**

**Проверьте наличие переменных:**

- [ ] `DATABASE_URL` — должна быть в списке
- [ ] `ENCRYPTION_KEY` — должна быть в списке
- [ ] Обе переменные имеют Scope: **Production** (или All scopes)

**Проверьте значения:**

- [ ] `DATABASE_URL` содержит строку подключения к PostgreSQL
- [ ] `ENCRYPTION_KEY` содержит ключ (должен заканчиваться на `=`)

**Как проверить значение:**

- Нажмите на переменную
- Нажмите на иконку глаза 👁️ чтобы показать значение
- Убедитесь, что значение правильное

### ✅ Шаг 2: Проверка деплоя

1. Перейдите: **Deploys** → выберите последний деплой
2. Проверьте статус:
   - [ ] Статус: **Published** (зелёная галочка ✅)
   - [ ] Нет ошибок в логах деплоя

**Если есть ошибки:**

- Проверьте логи деплоя
- Убедитесь, что переменные окружения добавлены **до** деплоя

### ✅ Шаг 3: Проверка логов Netlify Functions

1. Перейдите: **Deploys** → выберите последний деплой
2. Откройте вкладку **"Functions"**
3. Найдите функции:
   - `create-payment`
   - `payment-settings`
   - `payment-webhook`
4. Откройте **"Logs"** для каждой функции

**Что искать в логах:**

✅ **Хорошие признаки:**

- Нет ошибок `DATABASE_URL is not set`
- Нет ошибок `ENCRYPTION_KEY is not set`
- Нет ошибок подключения к базе данных

❌ **Плохие признаки:**

- `Error: DATABASE_URL environment variable is not set`
- `Error: ENCRYPTION_KEY environment variable is not set`
- `Error: connect ECONNREFUSED` (проблема подключения к БД)
- `Error: password authentication failed` (неправильный пароль в DATABASE_URL)

### ✅ Шаг 4: Тестирование API endpoints

#### 4.1. Проверка endpoint `/api/payment-settings`

**Требуется JWT** заголовка `Authorization: Bearer <token>` (как после входа в ЛК).

**Способ 1: браузер (вы уже авторизованы на сайте)**

```javascript
const token = localStorage.getItem('auth_token');
fetch('/api/payment-settings?provider=yookassa', {
  method: 'GET',
  headers: {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  },
})
  .then((res) => res.json())
  .then((data) => console.log('✅ Ответ:', data))
  .catch((err) => console.error('❌ Ошибка:', err));
```

Без входа ожидайте **401**. Подстановка чужого `userId` в query больше не даёт доступа — **403 Forbidden**.

**Способ 2: curl**

```bash
curl -X GET "https://YOUR_SITE/api/payment-settings?provider=yookassa" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json"
```

#### 4.2. Проверка подключения к базе данных

**Создайте тестовый запрос на сохранение (владелец записи берётся из JWT, без `userId` в теле):**

```javascript
const token = localStorage.getItem('auth_token');
fetch('/api/payment-settings', {
  method: 'POST',
  headers: {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    provider: 'yookassa',
    shopId: 'test-shop-id',
    secretKey: 'test-secret-key-123',
    isActive: true,
  }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log('✅ Ответ:', data);
    if (data.success) {
      console.log('✅ Подключение к БД работает!');
    } else {
      console.error('❌ Ошибка:', data.error);
    }
  })
  .catch((err) => console.error('❌ Ошибка:', err));
```

**Ожидаемый результат:**

```json
{
  "success": true,
  "settings": {
    "userId": "<совпадает с userId в вашем JWT>",
    "provider": "yookassa",
    "shopId": "test-shop-id",
    "isActive": true,
    "connectedAt": "2024-..."
  }
}
```

**Если ошибка:**

- Проверьте логи функции `payment-settings`
- Убедитесь, что `DATABASE_URL` правильный
- Проверьте, что база данных доступна из интернета

### ✅ Шаг 5: Проверка шифрования

**Проверьте, что секретные ключи шифруются:**

1. Выполните тестовый запрос на сохранение настроек (из шага 4.2)
2. Подключитесь к базе данных Supabase
3. Выполните SQL запрос:

```sql
SELECT
  user_id,
  provider,
  shop_id,
  secret_key_encrypted,
  is_active
FROM user_payment_settings
WHERE user_id = '<your_user_id_from_jwt>';
```

**Проверьте:**

- [ ] Запись существует в базе данных
- [ ] `secret_key_encrypted` содержит зашифрованное значение (не `test-secret-key-123`)
- [ ] Зашифрованное значение имеет формат: `hex.hex.hex.hex` (4 части, разделённые точками)

**Очистка тестовых данных:**

После проверки удалите тестовые данные:

```sql
DELETE FROM user_payment_settings WHERE user_id = '<your_user_id_from_jwt>' AND provider = 'yookassa';
```

### ✅ Шаг 6: Тестирование создания платежа

**Проверьте endpoint `/api/create-payment`:**

```javascript
fetch('/api/create-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 100,
    currency: 'RUB',
    description: 'Test payment',
    albumId: 'test-album-id',
    customerEmail: 'test@example.com',
    returnUrl: 'https://smolyanoechuchelko.ru',
  }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log('✅ Ответ:', data);
    if (data.success && data.confirmationUrl) {
      console.log('✅ Платеж создан! URL:', data.confirmationUrl);
    } else {
      console.error('❌ Ошибка:', data.error);
    }
  })
  .catch((err) => console.error('❌ Ошибка:', err));
```

**Ожидаемый результат:**

```json
{
  "success": true,
  "paymentId": "2c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
  "confirmationUrl": "https://yoomoney.ru/checkout/payments/..."
}
```

**Если ошибка:**

- Проверьте логи функции `create-payment`
- Убедитесь, что владелец альбома подключил ЮKassa через настройки сайта (`user_payment_settings` в БД)
- Проверьте `DATABASE_URL`, `ENCRYPTION_KEY` и логи функции `create-payment`

## 🔍 Детальная проверка через Netlify CLI

Если у вас установлен Netlify CLI, можно проверить локально:

### 1. Установите Netlify CLI (если не установлен)

```bash
npm install -g netlify-cli
```

### 2. Войдите в Netlify

```bash
netlify login
```

### 3. Свяжите проект с Netlify

```bash
netlify link
```

### 4. Загрузите переменные окружения

```bash
netlify env:list
```

**Проверьте вывод:**

- Должны быть видны `DATABASE_URL` и `ENCRYPTION_KEY`
- Значения должны быть правильными

### 5. Запустите функции локально

```bash
netlify dev
```

**Проверьте:**

- Функции запускаются без ошибок
- Нет ошибок `environment variable is not set`

## 📊 Итоговая таблица проверки

| Проверка                              | Статус | Комментарий                                             |
| ------------------------------------- | ------ | ------------------------------------------------------- |
| Переменные в Dashboard                | ⬜     | `DATABASE_URL` и `ENCRYPTION_KEY` видны                 |
| Деплой успешен                        | ⬜     | Статус "Published"                                      |
| Логи функций без ошибок               | ⬜     | Нет ошибок подключения                                  |
| GET `/api/payment-settings` работает  | ⬜     | С `Authorization: Bearer` после входа → `success: true` |
| POST `/api/payment-settings` работает | ⬜     | С Bearer; без чужого `userId`; сохранение в БД          |
| Шифрование работает                   | ⬜     | `secret_key_encrypted` зашифрован                       |
| POST `/api/create-payment` работает   | ⬜     | Создаёт платеж в ЮKassa                                 |

## 🆘 Решение проблем

### Проблема: Переменные не видны в логах

**Решение:**

1. Убедитесь, что переменные добавлены в правильный Scope (Production)
2. Передеплойте проект после добавления переменных
3. Проверьте, что вы смотрите логи последнего деплоя

### Проблема: "DATABASE_URL is not set"

**Решение:**

1. Проверьте, что переменная добавлена в Netlify Dashboard
2. Убедитесь, что Scope = Production
3. Передеплойте проект

### Проблема: "Connection refused" или "password authentication failed"

**Решение:**

1. Проверьте правильность `DATABASE_URL` (включая пароль)
2. Убедитесь, что база данных доступна из интернета
3. Проверьте, что используется правильный порт (5432 для Supabase)
4. Убедитесь, что используется Session Pooler (порт 5432), а не Direct connection

### Проблема: "Encryption key invalid"

**Решение:**

1. Убедитесь, что `ENCRYPTION_KEY` скопирован полностью (включая `=`)
2. Проверьте, что нет лишних пробелов
3. Передеплойте проект

### Проблема: Функция возвращает 500 ошибку

**Решение:**

1. Откройте логи функции в Netlify
2. Найдите конкретную ошибку
3. Проверьте, что все переменные окружения добавлены
4. Проверьте, что база данных доступна

## ✅ Готово!

Если все проверки пройдены успешно, ваша платежная система готова к работе! 🎉

## 📚 Дополнительные ресурсы

- [NETLIFY-ENV-SETUP-DETAILED.md](./NETLIFY-ENV-SETUP-DETAILED.md) - Настройка переменных
- [MIGRATION-COMPLETE.md](./MIGRATION-COMPLETE.md) - Статус миграции
- [NETLIFY-QUICK-START.md](./NETLIFY-QUICK-START.md) - Быстрый старт
