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
import dns from 'node:dns';

// Форсируем IPv4 для избежания проблем с fetch в некоторых сетях
dns.setDefaultResultOrder('ipv4first');

/**
 * Валидирует UUID формат
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Валидирует query параметр (UUID должен быть валидным, без угловых скобок и пробелов)
 */
function validateUUIDParameter(value: string | null | undefined, paramName: string): string | null {
  if (!value) {
    return null;
  }

  // Проверяем на угловые скобки и пробелы
  if (value.includes('<') || value.includes('>') || value.includes(' ') || value.trim() !== value) {
    return `${paramName} contains invalid characters (angle brackets or spaces are not allowed)`;
  }

  // Проверяем формат UUID
  if (!isValidUUID(value)) {
    return `${paramName} must be a valid UUID`;
  }

  return null;
}

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
       SET status = $1::text, 
           payment_id = $2,
           paid_at = CASE WHEN $1::text = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
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

    // Если платеж успешен, создаем или обновляем запись в purchases
    if (orderStatus === 'paid' && (paymentStatus.status === 'succeeded' || paymentStatus.paid)) {
      try {
        // Получаем информацию о заказе для создания покупки
        const orderResult = await query<{
          album_id: string;
          customer_email: string;
        }>(
          `SELECT album_id, customer_email 
           FROM orders 
           WHERE id = $1`,
          [orderId]
        );

        if (orderResult.rows.length > 0) {
          const order = orderResult.rows[0];
          const albumId = order.album_id || paymentStatus.metadata?.albumId;
          const customerEmail = order.customer_email || paymentStatus.metadata?.customerEmail;

          if (albumId && customerEmail) {
            // Создаем запись о покупке (или получаем существующую)
            const purchaseResult = await query<{
              id: string;
              purchase_token: string;
            }>(
              `INSERT INTO purchases (order_id, customer_email, album_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (customer_email, album_id) 
               DO UPDATE SET order_id = EXCLUDED.order_id, updated_at = CURRENT_TIMESTAMP
               RETURNING id, purchase_token`,
              [orderId, customerEmail, albumId]
            );

            if (purchaseResult.rows.length > 0) {
              const purchase = purchaseResult.rows[0];
              console.log('✅ Purchase created/updated:', {
                purchaseId: purchase.id,
                purchaseToken: purchase.purchase_token,
                orderId,
                albumId,
                customerEmail,
              });

              // Отправляем email (не блокируем основной поток)
              // Это резервный механизм на случай, если webhook не сработал
              import('./lib/email')
                .then(({ sendPurchaseEmail }) => {
                  // Получаем информацию об альбоме и треках
                  return query<{
                    artist: string;
                    album: string;
                    lang: string;
                    customer_first_name: string | null;
                    customer_last_name: string | null;
                  }>(
                    `SELECT a.artist, a.album, a.lang, o.customer_first_name, o.customer_last_name
                     FROM albums a
                     INNER JOIN orders o ON a.album_id = o.album_id
                     WHERE a.album_id = $1
                     ORDER BY CASE WHEN a.lang = 'ru' THEN 1 ELSE 2 END
                     LIMIT 1`,
                    [albumId]
                  ).then((albumResult) => {
                    if (albumResult.rows.length > 0) {
                      const album = albumResult.rows[0];

                      // Получаем треки альбома
                      return query<{
                        track_id: string;
                        title: string;
                      }>(
                        `SELECT t.track_id, t.title 
                         FROM tracks t
                         INNER JOIN albums a ON t.album_id = a.id
                         WHERE a.album_id = $1 AND a.lang = $2
                         ORDER BY t.order_index ASC`,
                        [albumId, album.lang]
                      ).then((tracksResult) => {
                        const tracks = tracksResult.rows.map((row) => ({
                          trackId: row.track_id,
                          title: row.title,
                        }));

                        const customerName =
                          album.customer_first_name && album.customer_last_name
                            ? `${album.customer_first_name} ${album.customer_last_name}`
                            : album.customer_first_name || undefined;

                        console.log('📧 [get-payment-status] Attempting to send purchase email:', {
                          to: customerEmail,
                          customerName,
                          albumName: album.album,
                          artistName: album.artist,
                          orderId,
                          tracksCount: tracks.length,
                          hasResendKey: !!process.env.RESEND_API_KEY,
                        });

                        return sendPurchaseEmail({
                          to: customerEmail,
                          customerName,
                          albumName: album.album,
                          artistName: album.artist,
                          orderId,
                          purchaseToken: purchase.purchase_token,
                          tracks,
                          siteUrl: process.env.NETLIFY_SITE_URL || undefined,
                        });
                      });
                    }
                    return Promise.resolve({ success: false, error: 'Album not found' });
                  });
                })
                .then((result) => {
                  if (result?.success) {
                    console.log('✅ [get-payment-status] Purchase email sent successfully:', {
                      to: customerEmail,
                      orderId,
                    });
                  } else {
                    console.error('❌ [get-payment-status] Failed to send purchase email:', {
                      to: customerEmail,
                      orderId,
                      error: result?.error,
                    });
                  }
                })
                .catch((emailError) => {
                  console.error('❌ [get-payment-status] Error sending purchase email:', {
                    to: customerEmail,
                    orderId,
                    error: emailError instanceof Error ? emailError.message : String(emailError),
                    stack: emailError instanceof Error ? emailError.stack : undefined,
                  });
                  // Не выбрасываем ошибку, чтобы не блокировать основной поток
                });
            }
          } else {
            console.warn('⚠️ Cannot create purchase: missing albumId or customerEmail', {
              albumId,
              customerEmail,
              orderId,
            });
          }
        }
      } catch (purchaseError) {
        // Не блокируем основной поток, если не удалось создать покупку
        console.error('❌ Error creating purchase:', purchaseError);
      }
    }

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

    // Запрещаем одновременную передачу paymentId и orderId
    if (paymentId && orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Provide either paymentId or orderId, not both',
        } as PaymentStatusResponse),
      };
    }

    // Валидация параметров (до обращения к БД)
    if (paymentId) {
      const validationError = validateUUIDParameter(paymentId, 'paymentId');
      if (validationError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: validationError,
          } as PaymentStatusResponse),
        };
      }
    }

    if (orderId) {
      const validationError = validateUUIDParameter(orderId, 'orderId');
      if (validationError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: validationError,
          } as PaymentStatusResponse),
        };
      }
    }

    // Если передан orderId, получаем paymentId из БД (только после валидации)
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

    // Проверяем DNS резолюцию перед fetch (опционально, не фатально)
    const urlObj = new URL(paymentUrl);
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

    // Отправляем запрос к YooKassa с таймаутом
    let yookassaResponse;
    const fetchStartTime = Date.now();

    try {
      // Используем AbortController с таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Fetch timeout reached, aborting...');
        controller.abort();
      }, 60000); // 60 секунд таймаут

      yookassaResponse = await fetch(paymentUrl, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;

      console.log('✅ YooKassa response received:', {
        status: yookassaResponse.status,
        statusText: yookassaResponse.statusText,
        duration: fetchDuration,
      });
    } catch (fetchError: any) {
      const fetchDuration = Date.now() - fetchStartTime;
      const isTimeoutError =
        fetchError?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        fetchError?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        fetchError?.message?.includes('timeout') ||
        fetchError?.message?.includes('aborted');

      console.error('❌ Fetch error to YooKassa:', {
        message: fetchError?.message,
        code: fetchError?.code,
        cause: fetchError?.cause,
        causeCode: fetchError?.cause?.code,
        causeMessage: fetchError?.cause?.message,
        stack: fetchError?.stack,
        duration: fetchDuration,
        isTimeoutError,
        paymentUrlHost: urlObj.hostname,
      });

      // В dev режиме возвращаем детали ошибки
      const isDev = process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV !== 'production';

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: isDev
            ? `Fetch failed: ${fetchError?.message || 'Unknown error'}`
            : 'Failed to fetch payment status from payment service',
          ...(isDev && {
            details: {
              code: fetchError?.code,
              cause: fetchError?.cause
                ? {
                    code: fetchError.cause.code,
                    message: fetchError.cause.message,
                  }
                : undefined,
              isTimeoutError,
              durationMs: fetchDuration,
              paymentUrlHost: urlObj.hostname,
            },
          }),
        } as PaymentStatusResponse),
      };
    }

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
    console.error('❌ Error getting payment status:', {
      message: error?.message,
      code: error?.code,
      cause: error?.cause,
      causeCode: error?.cause?.code,
      causeMessage: error?.cause?.message,
      stack: error?.stack,
    });

    // В dev режиме возвращаем детали ошибки для диагностики
    const isDev = process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV !== 'production';

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: isDev ? error?.message || 'Unknown error occurred' : 'Failed to get payment status',
        ...(isDev && {
          details: {
            code: error?.code,
            cause: error?.cause
              ? {
                  code: error.cause.code,
                  message: error.cause.message,
                }
              : undefined,
          },
        }),
      } as PaymentStatusResponse),
    };
  }
};
