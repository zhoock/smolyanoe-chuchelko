// netlify/functions/yookassa-health.ts
/**
 * Health check функция для диагностики YooKassa credentials и API доступности.
 *
 * GET /api/yookassa-health - проверяет наличие credentials и делает тестовый запрос к YooKassa
 *
 * Возвращает:
 * {
 *   success: boolean,
 *   env: { hasShopId, hasSecret, ... },
 *   yookassaTest: { success, status, error? }
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface HealthCheckResponse {
  success: boolean;
  env: {
    hasShopId: boolean;
    hasSecret: boolean;
    shopIdLength: number;
    secretKeyLength: number;
    secretKeyPrefix: string;
    nodeEnv?: string;
    netlifyDev?: string;
    hasDatabaseUrl: boolean;
  };
  yookassaTest: {
    success: boolean;
    status?: number;
    error?: string;
  };
  error?: string;
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

  // Только GET метод
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use GET.',
      } as HealthCheckResponse),
    };
  }

  try {
    // Получаем credentials из env
    const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
    const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim();
    const hasValidShopId = shopId && shopId.length > 0;
    const hasValidSecretKey = secretKey && secretKey.length > 0;

    const envInfo = {
      hasShopId: hasValidShopId,
      hasSecret: hasValidSecretKey,
      shopIdLength: shopId?.length || 0,
      secretKeyLength: secretKey?.length || 0,
      secretKeyPrefix: secretKey ? secretKey.substring(0, 6) + '***' : 'not set',
      nodeEnv: process.env.NODE_ENV,
      netlifyDev: process.env.NETLIFY_DEV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    };

    // Если credentials есть, делаем тестовый запрос к YooKassa
    let yookassaTest: { success: boolean; error?: string; status?: number } = {
      success: false,
      error: 'Credentials not available',
    };

    if (hasValidShopId && hasValidSecretKey) {
      try {
        const apiUrl = process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments';
        const authHeader = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

        // Делаем лёгкий запрос: список платежей с limit=1
        const testUrl = `${apiUrl}?limit=1`;
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
        });

        yookassaTest = {
          success: testResponse.ok,
          status: testResponse.status,
          error: testResponse.ok ? undefined : `HTTP ${testResponse.status}`,
        };

        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          try {
            const errorJson = JSON.parse(errorText);
            yookassaTest.error =
              errorJson.description || errorJson.code || `HTTP ${testResponse.status}`;
          } catch {
            yookassaTest.error = errorText.substring(0, 100) || `HTTP ${testResponse.status}`;
          }
        }
      } catch (testError: any) {
        yookassaTest = {
          success: false,
          error: testError?.message || 'Unknown error',
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        env: envInfo,
        yookassaTest,
      } as HealthCheckResponse),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Health check failed',
      } as HealthCheckResponse),
    };
  }
};
