/**
 * API endpoint для получения Shop ID платформы YooKassa
 * Используется для инициализации Checkout.js на frontend
 * Shop ID - публичная информация, поэтому безопасно отдавать его на frontend
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface ShopIdResponse {
  success: boolean;
  shopId?: string;
  error?: string;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  // Только GET запросы
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use GET.',
      } as ShopIdResponse),
    };
  }

  try {
    const shopId = process.env.YOOKASSA_SHOP_ID?.trim();

    if (!shopId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Shop ID not configured',
        } as ShopIdResponse),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        shopId,
      } as ShopIdResponse),
    };
  } catch (error) {
    console.error('❌ Error getting shop ID:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ShopIdResponse),
    };
  }
};
