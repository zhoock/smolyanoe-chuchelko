// netlify/functions/get-payment-status.ts
/**
 * Netlify Serverless Function для проверки статуса платежа через YooKassa API.
 *
 * ВАЖНО: Эта функция всегда проверяет статус через YooKassa API, а не доверяет БД.
 * Используется после возврата с YooMoney для проверки реального статуса платежа.
 *
 * GET /api/get-payment-status?paymentId=xxx
 * GET /api/get-payment-status?orderId=xxx
 *
 * Возвращает:
 * {
 *   success: boolean,
 *   payment: {
 *     id: string,
 *     status: 'pending' | 'succeeded' | 'canceled',
 *     paid: boolean,
 *     amount: { value: string, currency: string },
 *     cancellation_details?: { ... },
 *     metadata?: { orderId?: string, ... }
 *   },
 *   orderUpdated: boolean
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';

interface YooKassaPaymentStatus {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  cancellation_details?: {
    party: string;
    reason: string;
  };
  metadata?: {
    orderId?: string;
    albumId?: string;
    customerEmail?: string;
    [key: string]: string | undefined;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  created_at: string;
  captured_at?: string;
}

interface PaymentStatusResponse {
  success: boolean;
  payment?: {
    id: string;
    status: string;
    paid: boolean;
    amount: {
      value: string;
      currency: string;
    };
    cancellation_details?: {
      party: string;
      reason: string;
    };
    metadata?: {
      orderId?: string;
      [key: string]: string | undefined;
    };
    confirmation_url?: string; // URL для продолжения оплаты для pending статусов
  };
  orderUpdated?: boolean;
  error?: string;
}

/**
 * Получает YooKassa credentials из user settings или env
 */
async function getYooKassaCredentials(orderId?: string): Promise<{
  shopId: string;
  secretKey: string;
  source: 'user_settings' | 'env';
}> {
  let shopId: string | undefined;
  let secretKey: string | undefined;
  let source: 'user_settings' | 'env' = 'env';

  // Если есть orderId, пытаемся получить credentials из user settings
  if (orderId) {
    try {
      const orderResult = await query<{ user_id: string | null }>(
        'SELECT user_id FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length > 0 && orderResult.rows[0].user_id) {
        const userId = orderResult.rows[0].user_id;
        try {
          const { getDecryptedSecretKey } = await import('./payment-settings');
          const userCredentials = await getDecryptedSecretKey(userId, 'yookassa');

          if (userCredentials && userCredentials.shopId && userCredentials.secretKey) {
            shopId = userCredentials.shopId.trim();
            secretKey = userCredentials.secretKey.trim();
            source = 'user_settings';
            console.log(`✅ Using user ${userId} payment settings for order ${orderId}`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not get user ${userId} credentials, falling back to env:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not get order user_id, falling back to env:', error);
    }
  }

  // Fallback на platform account
  if (!shopId || !secretKey) {
    shopId = process.env.YOOKASSA_SHOP_ID?.trim();
    secretKey = process.env.YOOKASSA_SECRET_KEY?.trim();
    source = 'env';
  }

  // Проверка валидности
  if (!shopId || !secretKey || shopId.length === 0 || secretKey.length === 0) {
    throw new Error('YooKassa credentials not configured');
  }

  return { shopId, secretKey, source };
}

/**
 * Обновляет статус заказа и платежа в БД на основе данных от YooKassa
 */
async function updateOrderAndPaymentStatus(paymentStatus: YooKassaPaymentStatus): Promise<boolean> {
  const orderId = paymentStatus.metadata?.orderId;
  if (!orderId) {
    console.warn('⚠️ No orderId in payment metadata, skipping DB update');
    return false;
  }

  try {
    // Маппинг статусов YooKassa в наши статусы
    let orderStatus: string;
    if (paymentStatus.status === 'succeeded' || paymentStatus.paid) {
      orderStatus = 'paid';
    } else if (paymentStatus.status === 'canceled') {
      orderStatus = 'canceled';
    } else {
      orderStatus = 'pending_payment';
    }

    // Обновляем заказ
    await query(
      `UPDATE orders 
       SET status = $1, 
           payment_id = $2,
           paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [orderStatus, paymentStatus.id, orderId]
    );

    // Обновляем или создаём запись в payments
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
        paymentStatus.id,
        paymentStatus.status,
        paymentStatus.amount.value,
        paymentStatus.amount.currency,
      ]
    );

    console.log(
      `✅ Updated order ${orderId} and payment ${paymentStatus.id} to status: ${orderStatus}`
    );
    return true;
  } catch (error) {
    console.error('❌ Error updating order and payment status:', error);
    return false;
  }
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use GET.',
      } as PaymentStatusResponse),
    };
  }

  try {
    const paymentId = event.queryStringParameters?.paymentId;
    const orderId = event.queryStringParameters?.orderId;

    if (!paymentId && !orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'paymentId or orderId parameter is required',
        } as PaymentStatusResponse),
      };
    }

    // Если передан orderId, получаем paymentId из БД
    let actualPaymentId = paymentId;
    if (!actualPaymentId && orderId) {
      const orderResult = await query<{ payment_id: string | null }>(
        'SELECT payment_id FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order not found',
          } as PaymentStatusResponse),
        };
      }

      actualPaymentId = orderResult.rows[0].payment_id || undefined;
      if (!actualPaymentId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Order has no payment_id',
          } as PaymentStatusResponse),
        };
      }
    }

    // Получаем credentials
    const credentials = await getYooKassaCredentials(orderId || undefined);

    // Делаем запрос к YooKassa API
    const apiUrl = process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments';
    const paymentUrl = `${apiUrl}/${actualPaymentId}`;
    const authHeader = Buffer.from(`${credentials.shopId}:${credentials.secretKey}`).toString(
      'base64'
    );

    console.log(`🔍 Checking payment status via YooKassa API: ${actualPaymentId}`);

    const yookassaResponse = await fetch(paymentUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
    });

    if (!yookassaResponse.ok) {
      const errorText = await yookassaResponse.text();
      console.error('❌ YooKassa API error:', {
        status: yookassaResponse.status,
        statusText: yookassaResponse.statusText,
        errorText,
      });

      return {
        statusCode: yookassaResponse.status === 404 ? 404 : 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: `YooKassa API error: ${yookassaResponse.statusText}`,
        } as PaymentStatusResponse),
      };
    }

    const paymentStatus: YooKassaPaymentStatus = await yookassaResponse.json();

    console.log(`✅ Payment status from YooKassa:`, {
      paymentId: paymentStatus.id,
      status: paymentStatus.status,
      paid: paymentStatus.paid,
    });

    // Обновляем БД на основе реального статуса от YooKassa
    const orderUpdated = await updateOrderAndPaymentStatus(paymentStatus);

    // Возвращаем статус платежа
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        payment: {
          id: paymentStatus.id,
          status: paymentStatus.status,
          paid: paymentStatus.paid,
          amount: paymentStatus.amount,
          cancellation_details: paymentStatus.cancellation_details,
          metadata: paymentStatus.metadata,
          // Возвращаем confirmation_url для pending статусов
          confirmation_url:
            (paymentStatus.status === 'pending' ||
              paymentStatus.status === 'waiting_for_capture') &&
            paymentStatus.confirmation?.confirmation_url
              ? paymentStatus.confirmation.confirmation_url
              : undefined,
        },
        orderUpdated,
      } as PaymentStatusResponse),
    };
  } catch (error: any) {
    console.error('❌ Error getting payment status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error occurred',
      } as PaymentStatusResponse),
    };
  }
};
