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
 *    - YOOKASSA_RETURN_URL - URL возврата после оплаты (опционально)
 *
 * Пример использования:
 * POST /api/create-payment
 * Body: {
 *   amount: number,
 *   currency: string,
 *   description: string,
 *   albumId: string,
 *   customerEmail: string,
 *   returnUrl: string (опционально)
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
import dns from 'node:dns';

// Форсируем IPv4 для избежания проблем с fetch в некоторых сетях
dns.setDefaultResultOrder('ipv4first');

interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  description: string;
  albumId: string;
  customerEmail: string;
  returnUrl?: string;
  userId?: string; // ID музыканта-продавца (опционально, если нет - используется аккаунт платформы)
  orderId?: string; // ID существующего заказа (для повторной оплаты)
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
  orderId?: string;
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
          shopId = userCredentials.shopId?.trim();
          secretKey = userCredentials.secretKey?.trim();
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
      shopId = process.env.YOOKASSA_SHOP_ID?.trim();
      secretKey = process.env.YOOKASSA_SECRET_KEY?.trim();
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

    // Логируем credentials для диагностики (без полного secretKey)
    const credentialsSource = data.userId ? 'user_or_fallback' : 'env';
    const credsLog = {
      source: credentialsSource,
      shopId,
      secretKeyPrefix: secretKey?.slice(0, 6),
      secretKeyLen: secretKey?.length,
      hasUserId: !!data.userId,
    };
    console.log('🔐 YooKassa creds used:', credsLog);

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

    // Создаем или получаем заказ
    let orderId: string;
    let orderAmount: number;
    let orderStatus: string;

    if (data.orderId) {
      // Проверяем существующий заказ
      const orderResult = await query<{
        id: string;
        amount: number;
        status: string;
        payment_id: string | null;
      }>('SELECT id, amount, status, payment_id FROM orders WHERE id = $1', [data.orderId]);

      if (orderResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order not found',
          } as CreatePaymentResponse),
        };
      }

      const order = orderResult.rows[0];
      orderId = order.id;
      orderAmount = parseFloat(order.amount.toString());
      orderStatus = order.status;

      // Проверяем, что сумма совпадает
      if (Math.abs(orderAmount - data.amount) > 0.01) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Amount mismatch with existing order',
          } as CreatePaymentResponse),
        };
      }

      // Если заказ уже оплачен, не создаем новый платеж
      if (orderStatus === 'paid') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order already paid',
          } as CreatePaymentResponse),
        };
      }

      // Если есть активный платеж, возвращаем его URL
      if (order.payment_id) {
        const paymentResult = await query<{
          provider_payment_id: string;
          status: string;
        }>(
          `SELECT provider_payment_id, status 
           FROM payments 
           WHERE order_id = $1 AND status IN ('pending', 'waiting_for_capture')
           ORDER BY created_at DESC 
           LIMIT 1`,
          [orderId]
        );

        if (paymentResult.rows.length > 0) {
          const payment = paymentResult.rows[0];
          // Получаем актуальный статус платежа от ЮKassa
          // Для упрощения возвращаем существующий payment_id
          // В реальности нужно проверить статус через API ЮKassa
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              paymentId: payment.provider_payment_id,
              orderId,
              confirmationUrl: '', // Нужно получить из ЮKassa API
              message: 'Payment already exists for this order',
            } as CreatePaymentResponse),
          };
        }
      }
    } else {
      // Создаем новый заказ
      const orderResult = await query<{ id: string }>(
        `INSERT INTO orders (
          user_id, album_id, amount, currency, customer_email, 
          customer_first_name, customer_last_name, customer_phone,
          status, payment_provider
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          data.userId || null,
          data.albumId,
          data.amount,
          'RUB', // YooKassa работает только с рублями
          data.customerEmail,
          data.billingData?.firstName || null,
          data.billingData?.lastName || null,
          data.billingData?.phone || null,
          'pending_payment',
          'yookassa',
        ]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Failed to create order');
      }

      orderId = orderResult.rows[0].id;
      orderAmount = data.amount;
      orderStatus = 'pending_payment';
    }

    // Нормализуем телефон для YooKassa: только цифры, без символов
    // YooKassa требует формат: только цифры, без +, пробелов, скобок и т.п.
    // Для RU обычно: 11 цифр, начинается с 7 (например: 79211234567)
    let normalizedPhone: string | undefined;
    if (data.billingData?.phone) {
      // Удаляем все нецифровые символы
      const phoneDigits = data.billingData.phone.replace(/\D/g, '');

      // Проверяем валидность: для RU номер должен начинаться с 7 и быть длиной 11 цифр
      // Для других стран может быть другая длина, но минимум 10 цифр
      if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
        normalizedPhone = phoneDigits;
        console.log('✅ Phone normalized:', {
          original: data.billingData.phone,
          normalized: normalizedPhone,
        });
      } else {
        console.warn('⚠️ Invalid phone format, skipping phone in receipt:', {
          original: data.billingData.phone,
          digits: phoneDigits,
          length: phoneDigits.length,
        });
        // Не передаём телефон, если он невалидный
      }
    }

    // Формируем return URL с orderId
    const baseReturnUrl =
      data.returnUrl ||
      process.env.YOOKASSA_RETURN_URL ||
      (typeof event.headers.referer !== 'undefined'
        ? `${new URL(event.headers.referer).origin}/pay/success`
        : 'https://smolyanoechuchelko.ru/pay/success');

    const returnUrl = `${baseReturnUrl}?orderId=${orderId}`;

    // Формируем запрос к ЮKassa
    // ВАЖНО: YooKassa (российский платежный сервис) работает только с рублями (RUB)
    // Игнорируем валюту от клиента и принудительно используем RUB
    const yookassaCurrency = 'RUB';

    const yookassaRequest: YooKassaPaymentRequest = {
      amount: {
        value: data.amount.toFixed(2),
        currency: yookassaCurrency, // Принудительно RUB для YooKassa
      },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: data.description,
      metadata: {
        orderId: orderId,
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
          // Передаём телефон только если он нормализован и валиден
          ...(normalizedPhone && { phone: normalizedPhone }),
        },
        items: [
          {
            description: data.description,
            quantity: '1',
            amount: {
              value: data.amount.toFixed(2),
              currency: yookassaCurrency, // Принудительно RUB для YooKassa
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

    // Проверяем DNS резолюцию перед fetch
    const urlObj = new URL(apiUrl);
    const dnsStartTime = Date.now();

    try {
      const addresses = await dns.promises.lookup(urlObj.hostname, { family: 4 }); // Форсируем IPv4
      const dnsDuration = Date.now() - dnsStartTime;

      console.log('✅ DNS resolved:', {
        hostname: urlObj.hostname,
        address: addresses.address,
        family: addresses.family,
        duration: dnsDuration,
      });
    } catch (dnsError: any) {
      const dnsDuration = Date.now() - dnsStartTime;

      console.warn('⚠️ DNS lookup failed:', {
        hostname: urlObj.hostname,
        error: dnsError?.message,
        code: dnsError?.code,
        duration: dnsDuration,
      });
      // Продолжаем выполнение, возможно DNS резолвится при fetch
    }

    // Создаем Basic Auth заголовок (credentials уже trimmed выше)
    const authHeader = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    // Ключ идемпотентности на основе orderId для предотвращения дублей
    const idempotenceKey = `${orderId}-${Date.now()}`;

    // Логируем детали запроса перед отправкой (после формирования yookassaRequest)
    console.log('📤 Sending request to YooKassa:', {
      url: apiUrl,
      method: 'POST',
      orderId,
      idempotenceKey,
      receiptCustomer: yookassaRequest.receipt
        ? {
            email: yookassaRequest.receipt.customer.email,
            phone: yookassaRequest.receipt.customer.phone || 'not provided',
            fullName: yookassaRequest.receipt.customer.full_name || 'not provided',
          }
        : 'not provided',
      amount: yookassaRequest.amount.value,
      currency: yookassaRequest.amount.currency,
    });

    // Отправляем запрос к ЮKassa
    let yookassaResponse;
    const fetchStartTime = Date.now();

    // Retry логика для fetch запроса к YooKassa
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Используем AbortController с увеличенным таймаутом
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ Fetch timeout reached (attempt ${attempt + 1}), aborting...`);
          controller.abort();
        }, 60000); // 60 секунд таймаут

        yookassaResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authHeader}`,
            'Idempotence-Key': `${idempotenceKey}-attempt-${attempt}`,
            Connection: 'keep-alive',
          },
          body: JSON.stringify(yookassaRequest),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - fetchStartTime;

        console.log('✅ YooKassa response received:', {
          status: yookassaResponse.status,
          statusText: yookassaResponse.statusText,
          duration: fetchDuration,
          attempt: attempt + 1,
        });

        // Если получили ответ, выходим из цикла retry
        break;
      } catch (fetchError: any) {
        const fetchDuration = Date.now() - fetchStartTime;
        lastError = fetchError;

        const isTimeoutError =
          fetchError?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          fetchError?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          fetchError?.message?.includes('timeout') ||
          fetchError?.message?.includes('aborted');

        console.error(`❌ Fetch error to YooKassa (attempt ${attempt + 1}/${maxRetries + 1}):`, {
          message: fetchError?.message,
          code: fetchError?.code,
          cause: fetchError?.cause,
          duration: fetchDuration,
          isTimeoutError,
        });

        // Если это не последняя попытка и ошибка таймаута - делаем retry
        if (attempt < maxRetries && isTimeoutError) {
          const delay = 2000 * (attempt + 1); // Увеличиваем задержку: 2s, 4s
          console.warn(`⚠️ Retrying fetch in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Если это последняя попытка или не таймаут - пробрасываем ошибку
        throw fetchError;
      }
    }

    // Проверяем, что получили ответ после всех попыток
    if (!yookassaResponse) {
      const fetchDuration = Date.now() - fetchStartTime;
      console.error('❌ All fetch attempts failed:', {
        attempts: maxRetries + 1,
        duration: fetchDuration,
        lastError: lastError?.message,
      });
      throw lastError || new Error('All fetch attempts failed');
    }

    if (!yookassaResponse.ok) {
      const errorText = await yookassaResponse.text();
      console.error('❌ YooKassa API error:', {
        status: yookassaResponse.status,
        statusText: yookassaResponse.statusText,
        errorText,
      });

      // Пытаемся распарсить JSON ошибки от YooKassa
      let parsedError: any = null;
      let errorMessage = `Payment creation failed: ${yookassaResponse.statusText}`;
      let errorDetails: any = {};

      try {
        parsedError = JSON.parse(errorText);
        console.error('❌ YooKassa error details:', parsedError);

        // YooKassa возвращает ошибки в формате:
        // { "type": "error", "id": "...", "code": "...", "description": "...", "parameter": "..." }
        if (parsedError.description) {
          errorMessage = parsedError.description;
        }

        if (parsedError.parameter) {
          errorDetails.parameter = parsedError.parameter;
          errorMessage += ` (parameter: ${parsedError.parameter})`;
        }

        if (parsedError.code) {
          errorDetails.code = parsedError.code;
        }
      } catch (parseError) {
        // Если не удалось распарсить, используем текст как есть
        console.warn('⚠️ Could not parse YooKassa error JSON:', parseError);
      }

      return {
        statusCode: yookassaResponse.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          message: errorText, // Полный текст ошибки для диагностики
          ...errorDetails, // Детали ошибки (parameter, code)
        } as CreatePaymentResponse),
      };
    }

    const paymentData: YooKassaPaymentResponse = await yookassaResponse.json();

    console.log('✅ Payment created:', {
      paymentId: paymentData.id,
      status: paymentData.status,
      amount: paymentData.amount.value,
      orderId,
      albumId: data.albumId,
    });

    // Сохраняем платеж в БД
    try {
      await query(
        `INSERT INTO payments (
          order_id, provider, provider_payment_id, status, amount, currency
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (provider, provider_payment_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP`,
        [
          orderId,
          'yookassa',
          paymentData.id,
          paymentData.status,
          paymentData.amount.value,
          paymentData.amount.currency,
        ]
      );

      // Обновляем заказ с payment_id
      await query(
        `UPDATE orders 
         SET payment_id = $1, status = 'pending_payment', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [paymentData.id, orderId]
      );

      console.log('✅ Payment saved to database:', {
        orderId,
        paymentId: paymentData.id,
      });
    } catch (dbError) {
      console.error('❌ Error saving payment to database:', dbError);
      // Не прерываем процесс, платеж уже создан в ЮKassa
    }

    // Возвращаем URL для подтверждения платежа
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: paymentData.id,
        orderId,
        confirmationUrl: paymentData.confirmation?.confirmation_url || '',
      } as CreatePaymentResponse),
    };
  } catch (error: any) {
    console.error('❌ Error creating payment:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      code: error?.code,
      cause: error?.cause,
      stack: error?.stack,
    });

    // Детальная информация об ошибке для диагностики
    const errorDetails: any = {
      success: false,
      error: error?.message || 'Unknown error occurred',
    };

    // Добавляем детали для dev режима
    if (error?.cause) {
      errorDetails.code = error.cause.code;
      errorDetails.cause = error.cause.message || error.cause.toString();
    }

    // Добавляем код ошибки, если есть
    if (error?.code) {
      errorDetails.errorCode = error.code;
    }

    // В dev режиме возвращаем больше информации
    const isDev = process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV !== 'production';
    if (isDev) {
      errorDetails.stack = error?.stack;
      errorDetails.fullError = error?.toString();
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorDetails as CreatePaymentResponse),
    };
  }
};
