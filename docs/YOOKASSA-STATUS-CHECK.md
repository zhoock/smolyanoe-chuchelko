    # Проверка статуса платежа YooKassa

    Документация для проверки статуса платежа через API endpoint `/api/get-payment-status`.

    ## Endpoints

    ### GET /api/get-payment-status

    Проверяет статус платежа через YooKassa API. Принимает либо `paymentId`, либо `orderId`.

    **Важно:** Всегда проверяет реальный статус через YooKassa API, не доверяет только БД.

    ## Примеры использования

    ### По orderId (UUID заказа)

    ```bash
    curl -s "http://localhost:8888/api/get-payment-status?orderId=550e8400-e29b-41d4-a716-446655440000" | jq
    ```

    **⚠️ ВАЖНО:** Используйте правильные кавычки в curl:

    - ✅ Правильно: одинарные кавычки вокруг URL: `'http://...?orderId=...'`
    - ❌ Неправильно: двойные кавычки внутри URL: `"paymentId="..."` → вызовет ошибку `dquote>` в терминале

    ### По paymentId (UUID платежа YooKassa)

    ```bash
    curl -s "http://localhost:8888/api/get-payment-status?paymentId=30e6260c-000f-5001-8000-189836b342bf" | jq
    ```

    **⚠️ ВАЖНО:**

    - Не используйте двойные кавычки внутри URL-параметра
    - UUID должен быть валидным (формат: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
    - Не используйте угловые скобки `< >` или пробелы в параметрах

    ### Production

    ```bash
    curl -s "https://your-site.netlify.app/api/get-payment-status?orderId=550e8400-e29b-41d4-a716-446655440000" | jq
    ```

    ## Формат ответа

    ### Успешный ответ

    ```json
    {
    "success": true,
    "payment": {
        "id": "30e6260c-000f-5001-8000-189836b342bf",
        "status": "succeeded",
        "paid": true,
        "amount": {
        "value": "100.00",
        "currency": "RUB"
        },
        "metadata": {
        "orderId": "550e8400-e29b-41d4-a716-446655440000",
        "customerEmail": "customer@example.com"
        },
        "confirmation_url": "https://yoomoney.ru/..."
    },
    "orderUpdated": true
    }
    ```

### Для pending статусов

Если статус `pending` или `waiting_for_capture`, в ответе будет `confirmation_url` для продолжения оплаты (если он доступен от YooKassa):

```json
{
  "success": true,
  "payment": {
    "id": "30e6260c-000f-5001-8000-189836b342bf",
    "status": "pending",
    "paid": false,
    "amount": {
      "value": "100.00",
      "currency": "RUB"
    },
    "confirmation_url": "https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=..."
  }
}
```

**Примечание:** `confirmation_url` возвращается только для статусов `pending` и `waiting_for_capture`, если YooKassa API предоставил этот URL в ответе.

### Ошибка валидации (400)

**Невалидный UUID:**

```json
{
  "success": false,
  "error": "orderId must be a valid UUID"
}
```

**Недопустимые символы:**

```json
{
  "success": false,
  "error": "paymentId contains invalid characters (angle brackets or spaces are not allowed)"
}
```

**Одновременная передача обоих параметров:**

```json
{
  "success": false,
  "error": "Provide either paymentId or orderId, not both"
}
```

### Ошибка fetch (500)

В dev режиме (`NETLIFY_DEV=true` или `NODE_ENV!=production`) ответ содержит детали для диагностики:

```json
{
  "success": false,
  "error": "Fetch failed: connect timeout",
  "details": {
    "code": "UND_ERR_CONNECT_TIMEOUT",
    "cause": {
      "code": "UND_ERR_CONNECT_TIMEOUT",
      "message": "connect timeout"
    },
    "isTimeoutError": true,
    "durationMs": 60000,
    "paymentUrlHost": "api.yookassa.ru"
  }
}
```

В production возвращается только безопасное сообщение без деталей:

```json
{
  "success": false,
  "error": "Failed to fetch payment status from payment service"
}
```

    ## Статусы платежа

    - `pending` — платеж создан, ожидает оплаты
    - `waiting_for_capture` — платеж авторизован, ожидает подтверждения (capture)
    - `succeeded` — платеж успешно завершен
    - `canceled` — платеж отменен

    ## Типичные ошибки

    ### 1. Неправильный формат UUID

    **Ошибка:** `orderId must be a valid UUID`

    **Решение:** Убедитесь, что UUID в правильном формате: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

    **Неправильно:**

    ```bash
    # С угловыми скобками (плейсхолдеры) - вернет 400
    curl "http://localhost:8888/api/get-payment-status?orderId=<order-uuid>"

    # Не UUID формат - вернет 400
    curl "http://localhost:8888/api/get-payment-status?orderId=123"

    # Одновременная передача обоих параметров - вернет 400
    curl "http://localhost:8888/api/get-payment-status?paymentId=30e6...&orderId=c516..."
    ```

    **Правильно:**

    ```bash
    curl "http://localhost:8888/api/get-payment-status?orderId=c51663fc-dae2-45a5-81aa-50bea5c38baf"
    ```

    ### 2. Неправильные кавычки в curl

    **Ошибка в терминале:** `dquote>` (зависание)

    **Причина:** Двойные кавычки внутри URL-параметра

    **Неправильно:**

    ```bash
    curl "http://localhost:8888/api/get-payment-status?paymentId="30e6...""  # ❌
    ```

    **Правильно:**

    ```bash
    curl 'http://localhost:8888/api/get-payment-status?paymentId=30e6...'  # ✅
    # или
    curl "http://localhost:8888/api/get-payment-status?paymentId=30e6..."  # ✅ (без кавычек в значении)
    ```

    ### 3. Fetch failed

    **Ошибка:** `Fetch failed: connect timeout`

    **Возможные причины:**

    - Проблемы с сетью/IPv6
    - Таймаут подключения к YooKassa API
    - DNS проблемы

    **Решение:** Проверьте логи функции в dev режиме для деталей (см. `details` в ответе)

    ## Логирование

    Функция логирует:

    - DNS резолюцию (hostname, address, duration)
    - Fetch запросы (duration, status)
    - Детали ошибок (code, cause, stack)

    Логи доступны в Netlify Dashboard → Functions → Logs или в консоли при локальной разработке (`netlify dev`).
