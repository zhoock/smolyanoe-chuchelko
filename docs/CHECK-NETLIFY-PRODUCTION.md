# ✅ Проверка работы в Netlify Production

## 🎯 Быстрая проверка (2 минуты)

### 1. Проверьте переменные в Netlify Dashboard

1. Откройте https://app.netlify.com
2. Выберите проект **smolyanoechuchelko**
3. Перейдите: **Project configuration** → **Environment variables**

**Проверьте:**

- [ ] `DATABASE_URL` видна в списке
- [ ] `ENCRYPTION_KEY` видна в списке
- [ ] Обе переменные имеют Scope: **Production**

**Проверьте значения (нажмите на иконку глаза 👁️):**

- [ ] `DATABASE_URL` содержит: `postgresql://postgres.jhpvetvfnsklpwswadle:...`
- [ ] `ENCRYPTION_KEY` содержит: `[YOUR-ENCRYPTION-KEY]` (должен быть длинной строкой в base64)

### 2. Проверьте последний деплой

1. Перейдите: **Deploys** → выберите последний деплой
2. Проверьте статус:
   - [ ] Статус: **Published** (зелёная галочка ✅)
   - [ ] Деплой был **после** добавления переменных окружения

**Если деплой был до добавления переменных:**

- Нажмите **"Trigger deploy"** → **"Deploy site"**
- Дождитесь завершения деплоя

### 3. Проверьте логи функций

1. В деплое откройте вкладку **"Functions"**
2. Найдите функции:
   - `create-payment`
   - `payment-settings`
   - `payment-webhook`
3. Откройте **"Logs"** для каждой функции

**Что искать:**

✅ **Хорошие признаки:**

- Нет ошибок `DATABASE_URL is not set`
- Нет ошибок `ENCRYPTION_KEY is not set`
- Нет ошибок подключения к базе данных

❌ **Плохие признаки:**

- `Error: DATABASE_URL environment variable is not set`
- `Error: ENCRYPTION_KEY environment variable is not set`
- `Error: connect ECONNREFUSED`
- `Error: password authentication failed`

### 4. Протестируйте API на production сайте

Откройте ваш production сайт и в консоли браузера (F12) выполните:

```javascript
const token = localStorage.getItem('auth_token');
fetch('/api/payment-settings?provider=yookassa', {
  headers: {
    Authorization: token ? `Bearer ${token}` : '',
  },
})
  .then((r) => r.json())
  .then((d) => {
    console.log('✅ Ответ:', d);
    if (d.success) {
      console.log('✅ API работает!');
    } else {
      console.error('❌ Ошибка:', d.error);
    }
  })
  .catch((err) => console.error('❌ Ошибка:', err));
```

Без авторизации вернётся **`401`**. После входа в ЛК должно быть `success: true` (или пустые `settings`).

## 🔍 Детальная проверка

### Проверка через Netlify CLI

Если у вас установлен Netlify CLI:

```bash
# Войдите в Netlify
netlify login

# Свяжите проект
netlify link

# Проверьте переменные
netlify env:list

# Запустите функции локально с production переменными
netlify dev
```

### Проверка создания платежа

Попробуйте создать тестовый платеж через ваш сайт:

1. Откройте страницу с альбомом
2. Нажмите кнопку "Download" (Скачать)
3. Пройдите через процесс покупки
4. Проверьте, что платеж создаётся

**Если есть ошибки:**

- Проверьте логи функции `create-payment` в Netlify
- Убедитесь, что у артиста в БД подключены настройки ЮKassa (**Dashboard → платежи**), а у сайта есть `DATABASE_URL`, `ENCRYPTION_KEY`

## 🆘 Решение проблем

### Проблема: Переменные не видны в логах функций

**Решение:**

1. Убедитесь, что переменные добавлены в Scope: **Production**
2. Передеплойте проект после добавления переменных
3. Проверьте, что вы смотрите логи последнего деплоя

### Проблема: "DATABASE_URL is not set" в логах

**Решение:**

1. Проверьте, что переменная добавлена в Netlify Dashboard
2. Убедитесь, что Scope = **Production**
3. Передеплойте проект

### Проблема: API возвращает 500 ошибку

**Решение:**

1. Откройте логи функции в Netlify
2. Найдите конкретную ошибку
3. Проверьте, что все переменные окружения добавлены
4. Проверьте, что база данных доступна из интернета

## ✅ Итоговый чеклист

- [ ] Переменные `DATABASE_URL` и `ENCRYPTION_KEY` видны в Netlify Dashboard
- [ ] Переменные имеют Scope: **Production**
- [ ] Последний деплой был **после** добавления переменных
- [ ] Статус деплоя: **Published** ✅
- [ ] Логи функций не содержат ошибок
- [ ] На сайте авторизуйтесь, затем проверка `GET /api/payment-settings` с `Authorization: Bearer` возвращает `{"success": true}`
- [ ] Тестовый платеж создаётся успешно

## 🎉 Готово!

Если все проверки пройдены — ваша платежная система работает в production! 🚀
