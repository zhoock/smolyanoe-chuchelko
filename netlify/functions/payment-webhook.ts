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
 * - payment.waiting_for_capture - платеж ожидает подтверждения
 *
 * Пример использования:
 * POST /.netlify/functions/payment-webhook
 * Body: { event: string, object: PaymentObject }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';

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
      orderId?: string;
      albumId?: string;
      customerEmail?: string;
      [key: string]: string | undefined;
    };
    created_at: string;
    description: string;
    paid?: boolean;
    cancelled_at?: string;
    captured_at?: string;
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

    // Проверяем идемпотентность: не обрабатываем одно событие дважды
    const eventId = `${data.type}-${data.event}-${data.object.id}`;
    const existingEvent = await query<{ id: string }>(
      'SELECT id FROM webhook_events WHERE provider = $1 AND event_id = $2',
      ['yookassa', eventId]
    );

    if (existingEvent.rows.length > 0) {
      console.log('ℹ️ Webhook event already processed:', eventId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Event already processed',
        } as PaymentWebhookResponse),
      };
    }

    // Сохраняем событие для идемпотентности
    await query(
      `INSERT INTO webhook_events (provider, event_id, event_type, payment_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, event_id) DO NOTHING`,
      ['yookassa', eventId, data.event, data.object.id]
    );

    // Обрабатываем события платежа
    if (data.event === 'payment.succeeded') {
      const payment = data.object;
      const orderId = payment.metadata?.orderId;

      console.log('✅ Payment succeeded:', {
        paymentId: payment.id,
        orderId,
        amount: payment.amount.value,
        currency: payment.amount.currency,
        albumId: payment.metadata?.albumId,
        customerEmail: payment.metadata?.customerEmail,
      });

      try {
        // Обновляем платеж в БД
        await query(
          `UPDATE payments 
           SET status = 'succeeded', 
               updated_at = CURRENT_TIMESTAMP,
               raw_last_event = $1
           WHERE provider = 'yookassa' AND provider_payment_id = $2`,
          [JSON.stringify(data.object), payment.id]
        );

        // Обновляем заказ, если есть orderId
        if (orderId) {
          await query(
            `UPDATE orders 
             SET status = 'paid', 
                 paid_at = COALESCE($1::timestamp, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [payment.captured_at || null, orderId]
          );

          console.log('✅ Order updated to paid:', { orderId });
        } else {
          // Если нет orderId, пытаемся найти по payment_id
          await query(
            `UPDATE orders 
             SET status = 'paid', 
                 paid_at = COALESCE($1::timestamp, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE payment_id = $2`,
            [payment.captured_at || null, payment.id]
          );
        }

        // Создаем покупку и отправляем email
        if (orderId && payment.metadata?.albumId && payment.metadata?.customerEmail) {
          try {
            // Получаем информацию о заказе
            const orderResult = await query<{
              album_id: string;
              customer_email: string;
              customer_first_name: string | null;
              customer_last_name: string | null;
            }>(
              `SELECT album_id, customer_email, customer_first_name, customer_last_name 
               FROM orders 
               WHERE id = $1`,
              [orderId]
            );

            if (orderResult.rows.length > 0) {
              const order = orderResult.rows[0];
              const albumId = order.album_id || payment.metadata.albumId;
              const customerEmail = order.customer_email || payment.metadata.customerEmail;

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

                // Получаем информацию об альбоме и треках
                const albumResult = await query<{
                  artist: string;
                  album: string;
                  lang: string;
                }>(`SELECT artist, album, lang FROM albums WHERE album_id = $1 LIMIT 1`, [albumId]);

                if (albumResult.rows.length > 0) {
                  const album = albumResult.rows[0];

                  // Получаем треки альбома
                  const tracksResult = await query<{
                    track_id: string;
                    title: string;
                  }>(
                    `SELECT t.track_id, t.title 
                     FROM tracks t
                     INNER JOIN albums a ON t.album_id = a.id
                     WHERE a.album_id = $1 AND a.lang = $2
                     ORDER BY t.order_index ASC`,
                    [albumId, album.lang]
                  );

                  const tracks = tracksResult.rows.map((row) => ({
                    trackId: row.track_id,
                    title: row.title,
                  }));

                  // Отправляем email и дожидаемся результата
                  try {
                    const { sendPurchaseEmail } = await import('./lib/email');

                    const customerName =
                      order.customer_first_name && order.customer_last_name
                        ? `${order.customer_first_name} ${order.customer_last_name}`
                        : order.customer_first_name || undefined;

                    console.log('📧 Attempting to send purchase email:', {
                      to: customerEmail,
                      customerName,
                      albumName: album.album,
                      artistName: album.artist,
                      orderId,
                      tracksCount: tracks.length,
                      hasResendKey: !!process.env.RESEND_API_KEY,
                    });

                    const emailResult = await sendPurchaseEmail({
                      to: customerEmail,
                      customerName,
                      albumName: album.album,
                      artistName: album.artist,
                      orderId,
                      purchaseToken: purchase.purchase_token,
                      tracks,
                      siteUrl: process.env.NETLIFY_SITE_URL || undefined,
                    });

                    if (emailResult.success) {
                      console.log('✅ Purchase email sent successfully:', {
                        to: customerEmail,
                        orderId,
                      });
                    } else {
                      console.error('❌ Failed to send purchase email:', {
                        to: customerEmail,
                        orderId,
                        error: emailResult.error,
                      });
                    }
                  } catch (emailError) {
                    console.error('❌ Error sending purchase email:', {
                      to: customerEmail,
                      orderId,
                      error: emailError instanceof Error ? emailError.message : String(emailError),
                      stack: emailError instanceof Error ? emailError.stack : undefined,
                    });
                    // Не выбрасываем ошибку, чтобы не блокировать webhook
                  }
                } else {
                  console.warn('⚠️ Album not found for purchase email:', { albumId });
                }
              }
            }
          } catch (purchaseError) {
            console.error('❌ Error creating purchase or sending email:', purchaseError);
            // Не блокируем webhook, продолжаем выполнение
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Payment processed successfully',
          } as PaymentWebhookResponse),
        };
      } catch (dbError) {
        console.error('❌ Error processing payment.succeeded:', dbError);
        // Возвращаем 200, чтобы ЮKassa не повторял запрос
        // Но логируем ошибку для отладки
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Error processing payment, but acknowledged',
          } as PaymentWebhookResponse),
        };
      }
    }

    if (data.event === 'payment.canceled') {
      const payment = data.object;
      const orderId = payment.metadata?.orderId;

      console.log('❌ Payment canceled:', {
        paymentId: payment.id,
        orderId,
        albumId: payment.metadata?.albumId,
        cancelledAt: payment.cancelled_at,
      });

      try {
        // Обновляем платеж в БД
        await query(
          `UPDATE payments 
           SET status = 'canceled', 
               updated_at = CURRENT_TIMESTAMP,
               raw_last_event = $1
           WHERE provider = 'yookassa' AND provider_payment_id = $2`,
          [JSON.stringify(data.object), payment.id]
        );

        // Обновляем заказ
        if (orderId) {
          await query(
            `UPDATE orders 
             SET status = 'canceled', 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [orderId]
          );
        } else {
          await query(
            `UPDATE orders 
             SET status = 'canceled', 
                 updated_at = CURRENT_TIMESTAMP
             WHERE payment_id = $1`,
            [payment.id]
          );
        }

        console.log('✅ Order updated to canceled:', { orderId: orderId || payment.id });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Payment cancellation processed',
          } as PaymentWebhookResponse),
        };
      } catch (dbError) {
        console.error('❌ Error processing payment.canceled:', dbError);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Error processing cancellation, but acknowledged',
          } as PaymentWebhookResponse),
        };
      }
    }

    // Обработка других статусов
    if (data.event === 'payment.waiting_for_capture') {
      const payment = data.object;
      const orderId = payment.metadata?.orderId;

      console.log('⏳ Payment waiting for capture:', {
        paymentId: payment.id,
        orderId,
      });

      try {
        await query(
          `UPDATE payments 
           SET status = 'waiting_for_capture', 
               updated_at = CURRENT_TIMESTAMP,
               raw_last_event = $1
           WHERE provider = 'yookassa' AND provider_payment_id = $2`,
          [JSON.stringify(data.object), payment.id]
        );

        // Заказ остается в статусе pending_payment
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Payment waiting for capture processed',
          } as PaymentWebhookResponse),
        };
      } catch (dbError) {
        console.error('❌ Error processing payment.waiting_for_capture:', dbError);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Error processing, but acknowledged',
          } as PaymentWebhookResponse),
        };
      }
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
