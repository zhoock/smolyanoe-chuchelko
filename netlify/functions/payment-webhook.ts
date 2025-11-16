// netlify/functions/payment-webhook.ts
/**
 * Netlify Serverless Function для обработки webhook от ЮKassa.
 *
 * ВАЖНО: Для работы этой функции нужно:
 * 1. Настроить webhook URL в личном кабинете ЮKassa:
 *    https://yookassa.ru/my -> Настройки -> HTTP-уведомления
 * 2. Добавить URL: https://your-site.netlify.app/.netlify/functions/payment-webhook
 *
 * ЮKassa будет отправлять уведомления о смене статуса платежа:
 * - payment.succeeded - платеж успешно завершен
 * - payment.canceled - платеж отменен
 *
 * Пример использования:
 * POST /.netlify/functions/payment-webhook
 * Body: { event: string, object: PaymentObject }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface PaymentWebhookRequest {
  type: string;
  event: string;
  object: {
    id: string;
    status: string;
    amount: {
      value: string;
      currency: string;
    };
    metadata?: {
      albumId?: string;
      customerEmail?: string;
      [key: string]: string | undefined;
    };
    created_at: string;
    description: string;
    paid?: boolean;
    cancelled_at?: string;
  };
}

interface PaymentWebhookResponse {
  success: boolean;
  message?: string;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed. Use POST.',
      } as PaymentWebhookResponse),
    };
  }

  try {
    // Парсим тело запроса от ЮKassa
    const data: PaymentWebhookRequest = JSON.parse(event.body || '{}');

    console.log('📥 Payment webhook received:', {
      type: data.type,
      event: data.event,
      paymentId: data.object?.id,
      status: data.object?.status,
      albumId: data.object?.metadata?.albumId,
    });

    // Проверяем тип события
    if (data.type !== 'notification') {
      console.warn('⚠️ Unknown webhook type:', data.type);
      return {
        statusCode: 200, // Возвращаем 200, чтобы ЮKassa не повторял запрос
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Webhook type not processed',
        } as PaymentWebhookResponse),
      };
    }

    // Обрабатываем события платежа
    if (data.event === 'payment.succeeded') {
      const payment = data.object;

      console.log('✅ Payment succeeded:', {
        paymentId: payment.id,
        amount: payment.amount.value,
        currency: payment.amount.currency,
        albumId: payment.metadata?.albumId,
        customerEmail: payment.metadata?.customerEmail,
      });

      // TODO: Здесь должна быть логика обработки успешного платежа:
      // 1. Сохранить информацию о платеже в БД
      // 2. Активировать доступ к альбому для пользователя
      // 3. Отправить email с ссылкой на скачивание
      // 4. Обновить статус заказа

      // Пример сохранения в БД (требует настройки):
      // await savePaymentToDatabase({
      //   paymentId: payment.id,
      //   albumId: payment.metadata?.albumId,
      //   customerEmail: payment.metadata?.customerEmail,
      //   amount: payment.amount.value,
      //   currency: payment.amount.currency,
      //   status: 'succeeded',
      //   createdAt: payment.created_at,
      // });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Payment processed successfully',
        } as PaymentWebhookResponse),
      };
    }

    if (data.event === 'payment.canceled') {
      const payment = data.object;

      console.log('❌ Payment canceled:', {
        paymentId: payment.id,
        albumId: payment.metadata?.albumId,
        cancelledAt: payment.cancelled_at,
      });

      // TODO: Здесь должна быть логика обработки отмены платежа:
      // 1. Обновить статус платежа в БД
      // 2. Уведомить пользователя об отмене
      // 3. Освободить зарезервированные ресурсы (если были)

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Payment cancellation processed',
        } as PaymentWebhookResponse),
      };
    }

    // Для других событий просто подтверждаем получение
    console.log('ℹ️ Unhandled payment event:', data.event);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Webhook received',
      } as PaymentWebhookResponse),
    };
  } catch (error) {
    console.error('❌ Error processing payment webhook:', error);
    // Возвращаем 200, чтобы ЮKassa не повторял запрос при ошибке парсинга
    // Но можно вернуть 500 для критических ошибок, чтобы ЮKassa повторил запрос позже
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      } as PaymentWebhookResponse),
    };
  }
};
