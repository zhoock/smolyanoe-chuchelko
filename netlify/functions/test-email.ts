/**
 * Тестовая функция для отправки email через Resend
 *
 * Использование:
 * GET /.netlify/functions/test-email?email=your@email.com
 * или
 * POST /.netlify/functions/test-email
 * Body: { email: "your@email.com" }
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { sendPurchaseEmail } from './lib/email';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  CORS_HEADERS,
  parseJsonBody,
} from './lib/api-helpers';

interface TestEmailRequest {
  email?: string;
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  try {
    let email: string | undefined;

    // Получаем email из query параметров (GET) или body (POST)
    if (event.httpMethod === 'GET') {
      email = event.queryStringParameters?.email;
    } else if (event.httpMethod === 'POST') {
      const data = parseJsonBody<TestEmailRequest>(event.body, {});
      email = data.email;
    } else {
      return createErrorResponse(405, 'Method not allowed. Use GET or POST.');
    }

    if (!email) {
      return createErrorResponse(
        400,
        'Email parameter is required. Use ?email=your@email.com or send in POST body.'
      );
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse(400, 'Invalid email format.');
    }

    console.log('🧪 [test-email] Sending test purchase email to:', email);

    // Отправляем тестовый email с тестовыми данными
    const result = await sendPurchaseEmail({
      to: email,
      customerName: 'Тестовый Покупатель',
      albumName: 'Тестовый альбом',
      artistName: 'Тестовый артист',
      orderId: 'TEST-' + Date.now().toString(36).toUpperCase(),
      purchaseToken: 'test-token-' + Date.now(),
      tracks: [
        { trackId: '1', title: 'Тестовый трек 1' },
        { trackId: '2', title: 'Тестовый трек 2' },
        { trackId: '3', title: 'Тестовый трек 3' },
      ],
      siteUrl: process.env.NETLIFY_SITE_URL || 'https://smolyanoechuchelko.ru',
    });

    if (!result.success) {
      console.error('❌ [test-email] Failed to send email:', result.error);
      return createErrorResponse(500, result.error || 'Failed to send email');
    }

    console.log('✅ [test-email] Test email sent successfully to:', email);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Test email sent successfully',
        email,
      }),
    };
  } catch (error) {
    console.error('❌ [test-email] Error:', error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
};
