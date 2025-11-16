# Интеграция с ЮKassa

Данная документация описывает интеграцию платежной системы ЮKassa для приема платежей в России и странах СНГ.

## Что было реализовано

### Backend (Netlify Functions)

1. **`/netlify/functions/create-payment.ts`** - Создание платежа через ЮKassa API
   - Принимает данные о платеже от фронтенда
   - Создает платеж в ЮKassa
   - Возвращает URL для подтверждения платежа

2. **`/netlify/functions/payment-webhook.ts`** - Обработка webhook от ЮKassa
   - Обрабатывает события `payment.succeeded` и `payment.canceled`
   - Сохраняет информацию о платежах (требует доработки)

### Frontend

1. **`/src/shared/api/payment/index.ts`** - Утилита для вызова API платежей
   - Функция `createPayment()` для создания платежа

2. **`/src/entities/service/ui/PurchasePopup.tsx`** - Обновлен компонент покупки
   - Интеграция с ЮKassa API
   - Обработка состояния загрузки
   - Отображение ошибок платежа
   - Перенаправление на страницу оплаты ЮKassa

## Настройка ЮKassa

### 1. Регистрация в ЮKassa

1. Зарегистрируйтесь на https://yookassa.ru/
2. Пройдите верификацию (для приема платежей)
3. Получите `shopId` и `secretKey` в личном кабинете

### 2. Настройка переменных окружения в Netlify

В настройках проекта Netlify добавьте следующие переменные окружения:

```
YOOKASSA_SHOP_ID=ваш_shop_id
YOOKASSA_SECRET_KEY=ваш_secret_key
YOOKASSA_API_URL=https://api.yookassa.ru/v3/payments
```

**Важно:** В тестовом режиме используйте те же URL, но с тестовыми ключами.

### 3. Настройка Webhook

1. В личном кабинете ЮKassa перейдите в раздел "Настройки" -> "HTTP-уведомления"
2. Добавьте URL для получения уведомлений:
   ```
   https://your-site.netlify.app/.netlify/functions/payment-webhook
   ```
3. Выберите события для отправки:
   - `payment.succeeded` - Платеж успешно завершен
   - `payment.canceled` - Платеж отменен

### 4. Проверка работы

1. Убедитесь, что переменные окружения настроены в Netlify
2. Протестируйте создание платежа через форму покупки
3. Проверьте логи Netlify Functions на наличие ошибок
4. Проверьте webhook в личном кабинете ЮKassa (должны приходить уведомления)

## Что нужно доработать

### 1. Сохранение платежей в БД

В функции `payment-webhook.ts` нужно реализовать сохранение информации о платежах:

```typescript
// TODO: Сохранить в БД
await savePaymentToDatabase({
  paymentId: payment.id,
  albumId: payment.metadata?.albumId,
  customerEmail: payment.metadata?.customerEmail,
  amount: payment.amount.value,
  currency: payment.amount.currency,
  status: 'succeeded',
  createdAt: payment.created_at,
});
```

### 2. Активация доступа к альбому

После успешного платежа нужно предоставить пользователю доступ к скачиванию альбома:

```typescript
// TODO: Активировать доступ к альбому
await activateAlbumAccess({
  albumId: payment.metadata?.albumId,
  customerEmail: payment.metadata?.customerEmail,
  paymentId: payment.id,
});
```

### 3. Отправка email с ссылкой на скачивание

После успешного платежа отправить пользователю email:

```typescript
// TODO: Отправить email с ссылкой на скачивание
await sendDownloadEmail({
  email: payment.metadata?.customerEmail,
  albumId: payment.metadata?.albumId,
  downloadUrl: generateDownloadUrl(payment.id),
});
```

### 4. Обработка возврата после оплаты

В компоненте покупки можно добавить обработку возврата после оплаты:

```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    // Показать сообщение об успешной оплате
    // Предоставить ссылку на скачивание
  }
}, []);
```

## Тестирование

### Тестовый режим

1. Используйте тестовые ключи от ЮKassa
2. Для тестирования используйте тестовые карты (см. документацию ЮKassa)
3. Проверьте работу webhook в тестовом режиме

### Production

1. Переключитесь на production ключи
2. Убедитесь, что все настройки правильные
3. Проведите тестовый платеж на небольшую сумму

## Полезные ссылки

- [Документация ЮKassa API](https://yookassa.ru/developers/api)
- [Тестовые карты](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing)
- [Webhook уведомления](https://yookassa.ru/developers/using-api/webhooks)

## Поддержка

При возникновении проблем:

1. Проверьте логи Netlify Functions
2. Проверьте настройки в личном кабинете ЮKassa
3. Убедитесь, что переменные окружения настроены правильно
