/**
 * Shop ID продавца YooKassa для Checkout.js (по альбому).
 * Без общего shop ID платформы: только владелец альбома с активной ЮKassa.
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';

interface ShopIdResponse {
  success: boolean;
  shopId?: string;
  error?: string;
  message?: string;
}

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
    const albumId = event.queryStringParameters?.albumId?.trim();
    if (!albumId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'albumId query parameter is required',
        } as ShopIdResponse),
      };
    }

    if (!isValidUUID(albumId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'albumId must be a valid UUID',
        } as ShopIdResponse),
      };
    }

    const albumRow = await query<{ user_id: string | null }>(
      'SELECT user_id FROM albums WHERE album_id = $1 LIMIT 1',
      [albumId]
    );

    if (albumRow.rows.length === 0 || !albumRow.rows[0].user_id) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Album not found',
        } as ShopIdResponse),
      };
    }

    const sellerId = albumRow.rows[0].user_id;

    const settings = await query<{ shop_id: string | null }>(
      `SELECT shop_id FROM user_payment_settings
       WHERE user_id = $1 AND provider = 'yookassa' AND is_active = true`,
      [sellerId]
    );

    const shopId = settings.rows[0]?.shop_id?.trim();
    if (!shopId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'seller_payment_not_configured',
          message:
            'This artist has not connected YooKassa or payments are disabled. Checkout is unavailable.',
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
