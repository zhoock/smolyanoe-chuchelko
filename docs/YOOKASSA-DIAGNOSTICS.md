# Диагностика YooKassa Payment Service

## Проблема: invalid_credentials (401)

Если вы получаете ошибку `invalid_credentials` от YooKassa API, это означает, что credentials (shopId или secretKey) неверны или отсутствуют.

## Быстрая диагностика

### 1. Health Check Endpoint

Проверка **инфраструктуры** multi-tenant оплаты (не глобальные shop/secret Netlify):

```bash
curl http://localhost:8888/api/yookassa-health
# Опционально — число активных продавцов с заполненными ЮKassa-кредами в БД:
curl "http://localhost:8888/api/yookassa-health?includeTenantStats=true"
```

Ответ (основные поля):

- `architecture`: `"multi_tenant_per_seller"` — креды продавца только в `user_payment_settings`, не в ENV.
- `status`: `healthy` | `degraded` | `unhealthy` — см. `message`.
- `checks.yookassaApiHost` — доступность host API YooKassa (**без** merchant Basic Auth, без создания платежей).
- `checks.database` — результат `SELECT 1` по `DATABASE_URL`.
- `checks.sellerSecretsEncryption` — наличие `ENCRYPTION_KEY` (нужен для секретов продавцов в БД).
- `tenantStats.activeYookassaSellersWithCredentials` — только при `includeTenantStats=true`.

HTTP **503**, если `status === "unhealthy"` (критично упали API host или БД). Глобальные `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` **не** используются.

### 2. Диагностический режим create-payment

Можно использовать диагностический режим без создания реального платежа:

```bash
curl -X POST http://localhost:8888/api/create-payment \
  -H "Content-Type: application/json" \
  -d '{"diagnose": true}'
```

## Локальная разработка

### Настройка переменных окружения

1. **Создайте `.env` файл в корне проекта** (если его нет):

```bash
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=...
# Опционально:
# YOOKASSA_API_URL=https://api.yookassa.ru/v3/payments

# Shop ID и секрет продавца задаются в ЛК сайта (payment settings) и пишутся в БД — не в .env
```

2. **Запустите Netlify Dev**:

```bash
netlify dev
```

Netlify Dev **автоматически** читает `.env` файл из корня проекта. Дополнительные опции не нужны.

### Проверка что env загружены

После запуска `netlify dev`, при каждом запросе к `/api/create-payment` в логах терминала кратко видно окружение функции (например `hasDb`), **без** глобальных YooKassa shop/secret.

## Production (Netlify)

В production переменные окружения настраиваются через Netlify Dashboard:

1. Откройте: https://app.netlify.com/sites/YOUR-SITE/settings/env
2. Убедитесь, что установлены как минимум: `DATABASE_URL`, `ENCRYPTION_KEY`

## Типичные проблемы

### Проблема: `seller_payment_not_configured` / «артист не подключил YooKassa»

**Причина**: для владельца альбома нет активной строки в `user_payment_settings` (или она выключена).

**Решение**:

1. Войдите как артист и сохраните ЮKassa в настройках платежей (данные попадут в БД)
2. Проверьте `DATABASE_URL` и что миграции применены

### Проблема: "invalid_credentials" от YooKassa

**Причина**: Неверные shopId или secretKey.

**Решение**:

1. Проверьте credentials в YooKassa Dashboard
2. Убедитесь, что используете правильные значения (не тестовые, если нужны production)
3. Проверьте, что нет лишних пробелов: используйте `.trim()` (уже добавлено в код)

### Проблема: env пустые в функции, но есть в терминале

**Причина**: `netlify dev` был запущен до создания/обновления `.env` файла.

**Решение**:

1. Остановите `netlify dev` (Ctrl+C)
2. Убедитесь, что `.env` файл существует и содержит нужные переменные
3. Запустите `netlify dev` заново

## Логирование

После загрузки кредов продавца из БД в логах могут фигурировать маскированные префиксы секрета и метаданные длины — **полный** secretKey в лог не пишется.

## Проверка кредов продавца через curl

Shop ID и секрет берите из личного кабинета ЮKassa (или из тестовых данных магазина). Подставьте вручную:

```bash
curl -u "YOUR_SHOP_ID:YOUR_SECRET_KEY" \
  https://api.yookassa.ru/v3/payments?limit=1 \
  -H "Content-Type: application/json"
```

Ответ **200** означает, что пара shop:secret принята API. **401** — неверные или чужие ключи.
