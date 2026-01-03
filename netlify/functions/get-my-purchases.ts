/**
 * Netlify Function для получения списка покупок покупателя
 * GET /api/get-my-purchases?email=user@example.com
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  CORS_HEADERS,
} from './lib/api-helpers';

interface Purchase {
  id: string;
  orderId: string;
  albumId: string;
  artist: string;
  album: string;
  cover: string | null;
  purchaseToken: string;
  purchasedAt: string;
  downloadCount: number;
  tracks: Array<{
    trackId: string;
    title: string;
  }>;
}

interface GetMyPurchasesResponse {
  success: boolean;
  purchases?: Purchase[];
  error?: string;
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return createErrorResponse(405, 'Method not allowed. Use GET.');
  }

  try {
    const email = event.queryStringParameters?.email;

    if (!email) {
      return createErrorResponse(400, 'Email parameter is required');
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse(400, 'Invalid email format');
    }

    console.log('📋 [get-my-purchases] Fetching purchases for email:', email);

    // Проверяем существование таблицы purchases
    try {
      const tableCheckResult = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'purchases'
        ) as exists`
      );

      if (!tableCheckResult.rows[0]?.exists) {
        console.warn(
          '⚠️ [get-my-purchases] Table "purchases" does not exist. Please run migration 021_create_purchases.sql'
        );
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            purchases: [],
          }),
        };
      }
    } catch (tableCheckError) {
      console.error('❌ [get-my-purchases] Error checking table existence:', tableCheckError);
      // Продолжаем выполнение, возможно таблица существует
    }

    // Получаем все покупки покупателя
    const purchasesResult = await query<{
      id: string;
      order_id: string;
      album_id: string;
      purchase_token: string;
      purchased_at: Date;
      download_count: number;
    }>(
      `SELECT id, order_id, album_id, purchase_token, purchased_at, download_count
       FROM purchases
       WHERE customer_email = $1
       ORDER BY purchased_at DESC`,
      [email]
    );

    console.log('📋 [get-my-purchases] Found purchases:', purchasesResult.rows.length);

    if (purchasesResult.rows.length === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          purchases: [],
        }),
      };
    }

    // Для каждой покупки получаем информацию об альбоме и треках
    const purchases: Purchase[] = await Promise.all(
      purchasesResult.rows.map(async (purchaseRow) => {
        // Получаем информацию об альбоме (берем первую найденную языковую версию)
        // ВАЖНО: cover хранится как TEXT (после миграции 015), просто возвращаем его
        const albumResult = await query<{
          artist: string;
          album: string;
          lang: string;
          cover: string | null;
        }>(`SELECT artist, album, lang, cover FROM albums WHERE album_id = $1 LIMIT 1`, [
          purchaseRow.album_id,
        ]);

        if (albumResult.rows.length === 0) {
          // Если альбом не найден, возвращаем минимальную информацию
          return {
            id: purchaseRow.id,
            orderId: purchaseRow.order_id,
            albumId: purchaseRow.album_id,
            artist: 'Unknown',
            album: purchaseRow.album_id,
            cover: null,
            purchaseToken: purchaseRow.purchase_token,
            purchasedAt: purchaseRow.purchased_at.toISOString(),
            downloadCount: purchaseRow.download_count,
            tracks: [],
          };
        }

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
          [purchaseRow.album_id, album.lang]
        );

        return {
          id: purchaseRow.id,
          orderId: purchaseRow.order_id,
          albumId: purchaseRow.album_id,
          artist: album.artist,
          album: album.album,
          cover: album.cover || null,
          purchaseToken: purchaseRow.purchase_token,
          purchasedAt: purchaseRow.purchased_at.toISOString(),
          downloadCount: purchaseRow.download_count,
          tracks: tracksResult.rows.map((row) => ({
            trackId: row.track_id,
            title: row.title,
          })),
        };
      })
    );

    console.log('✅ [get-my-purchases] Successfully fetched purchases:', purchases.length);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        purchases,
      }),
    };
  } catch (error) {
    console.error('❌ [get-my-purchases] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    // Проверяем, является ли ошибка связанной с отсутствием таблицы
    const errorString = errorMessage.toLowerCase();
    if (errorString.includes('relation') && errorString.includes('does not exist')) {
      console.error(
        '❌ [get-my-purchases] Table does not exist. Please run migrations 020 and 021.'
      );
      return createErrorResponse(
        500,
        'Database table not found. Please contact support or check if migrations are applied.'
      );
    }

    console.error('❌ [get-my-purchases] Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      email: event.queryStringParameters?.email,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    return createErrorResponse(500, errorMessage);
  }
};
