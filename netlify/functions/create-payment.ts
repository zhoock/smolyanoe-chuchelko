// netlify/functions/create-payment.ts
/**
 * Netlify Serverless Function для создания платежа через ЮKassa API.
 *
 * ВАЖНО: Для работы этой функции нужно:
 * 1. Зарегистрироваться в ЮKassa (https://yookassa.ru/)
 * 2. Получить shopId и secretKey
 * 3. Настроить переменные окружения в Netlify:
 *    - YOOKASSA_SHOP_ID - ID магазина
 *    - YOOKASSA_SECRET_KEY - Секретный ключ
 *
 * Пример использования:
 * POST /api/create-payment
 * Body: {
 *   amount: number,
 *   currency: string,
 *   description: string,
 *   albumId: string,
 *   customerEmail: string,
 *   returnUrl: string
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  description: string;
  albumId: string;
  customerEmail: string;
  returnUrl?: string;
  userId?: string; // ID музыканта-продавца (опционально, если нет - используется аккаунт платформы)
  billingData?: {
    firstName: string;
    lastName: string;
    phone?: string;
    country?: string;
    zip?: string;
  };
}

interface CreatePaymentResponse {
  success: boolean;
  paymentId?: string;
  confirmationUrl?: string;
  error?: string;
  message?: string;
}

interface YooKassaPaymentRequest {
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: 'redirect';
    return_url: string;
  };
  description: string;
  metadata?: {
    albumId: string;
    customerEmail: string;
    [key: string]: string;
  };
  receipt?: {
    customer: {
      email: string;
      full_name?: string;
      phone?: string;
    };
    items: Array<{
      description: string;
      quantity: string;
      amount: {
        value: string;
        currency: string;
      };
      vat_code?: number;
    }>;
  };
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    confirmation_url: string;
  };
  created_at: string;
  description: string;
  metadata?: {
    [key: string]: string;
  };
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // CORS headers для работы с фронтенда
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.',
      } as CreatePaymentResponse),
    };
  }

  try {
    // Парсим тело запроса
    const data: CreatePaymentRequest = JSON.parse(event.body || '{}');

    // Получаем shopId и secretKey
    // Если указан userId, используем индивидуальный аккаунт музыканта
    // Иначе используем аккаунт платформы по умолчанию
    let shopId: string | undefined;
    let secretKey: string | undefined;

    if (data.userId) {
      // Получаем настройки платежей из БД для конкретного пользователя
      try {
        const { getDecryptedSecretKey } = await import('./payment-settings');
        const userCredentials = await getDecryptedSecretKey(data.userId, 'yookassa');

        if (userCredentials && userCredentials.shopId && userCredentials.secretKey) {
          shopId = userCredentials.shopId;
          secretKey = userCredentials.secretKey;
          console.log(`✅ Using user ${data.userId} payment settings`);
        } else {
          console.log(`ℹ️ User ${data.userId} has no payment settings - using platform account`);
        }
      } catch (error) {
        console.error(`❌ Error getting user ${data.userId} payment settings:`, error);
        // При ошибке используем аккаунт платформы
        console.log(`ℹ️ Falling back to platform account for user ${data.userId}`);
      }
    }

    // Если не найден индивидуальный аккаунт, используем аккаунт платформы
    if (!shopId || !secretKey) {
      shopId = process.env.YOOKASSA_SHOP_ID;
      secretKey = process.env.YOOKASSA_SECRET_KEY;
    }

    if (!shopId || !secretKey) {
      console.error('❌ YooKassa credentials not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Payment service not configured. Please contact support.',
        } as CreatePaymentResponse),
      };
    }

    // Валидация данных
    if (!data.amount || !data.description || !data.albumId || !data.customerEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid request data. Required: amount, description, albumId, customerEmail',
        } as CreatePaymentResponse),
      };
    }

    // Минимальная сумма для ЮKassa - 0.01 (1 копейка)
    if (data.amount < 0.01) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Amount must be at least 0.01',
        } as CreatePaymentResponse),
      };
    }

    // Формируем return URL
    const returnUrl =
      data.returnUrl ||
      (typeof event.headers.referer !== 'undefined'
        ? `${new URL(event.headers.referer).origin}${new URL(event.headers.referer).pathname}?payment=success`
        : 'https://smolyanoechuchelko.ru/?payment=success');

    // Формируем запрос к ЮKassa
    const yookassaRequest: YooKassaPaymentRequest = {
      amount: {
        value: data.amount.toFixed(2),
        currency: data.currency || 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: data.description,
      metadata: {
        albumId: data.albumId,
        customerEmail: data.customerEmail,
        ...(data.billingData?.firstName && { firstName: data.billingData.firstName }),
        ...(data.billingData?.lastName && { lastName: data.billingData.lastName }),
      },
      receipt: {
        customer: {
          email: data.customerEmail,
          ...(data.billingData?.firstName &&
            data.billingData?.lastName && {
              full_name: `${data.billingData.firstName} ${data.billingData.lastName}`,
            }),
          ...(data.billingData?.phone && { phone: data.billingData.phone }),
        },
        items: [
          {
            description: data.description,
            quantity: '1',
            amount: {
              value: data.amount.toFixed(2),
              currency: data.currency || 'RUB',
            },
            vat_code: 1, // НДС не облагается (для цифровых товаров в РФ часто используется код 1)
          },
        ],
      },
    };

    // Используем production или test API
    // В тестовом режиме используйте: https://api.yookassa.ru/v3/payments
    // В production используйте: https://api.yookassa.ru/v3/payments
    const apiUrl = process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments';

    // Создаем Basic Auth заголовок
    const authHeader = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    // Отправляем запрос к ЮKassa
    const yookassaResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
        'Idempotence-Key': `${data.albumId}-${Date.now()}`, // Уникальный ключ для идемпотентности
      },
      body: JSON.stringify(yookassaRequest),
    });

    if (!yookassaResponse.ok) {
      const errorText = await yookassaResponse.text();
      console.error('❌ YooKassa API error:', yookassaResponse.status, errorText);
      return {
        statusCode: yookassaResponse.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Payment creation failed: ${yookassaResponse.statusText}`,
          message: errorText,
        } as CreatePaymentResponse),
      };
    }

    const paymentData: YooKassaPaymentResponse = await yookassaResponse.json();

    console.log('✅ Payment created:', {
      paymentId: paymentData.id,
      status: paymentData.status,
      amount: paymentData.amount.value,
      albumId: data.albumId,
    });

    // Возвращаем URL для подтверждения платежа
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: paymentData.id,
        confirmationUrl: paymentData.confirmation?.confirmation_url || '',
      } as CreatePaymentResponse),
    };
  } catch (error) {
    console.error('❌ Error creating payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      } as CreatePaymentResponse),
    };
  }
};
