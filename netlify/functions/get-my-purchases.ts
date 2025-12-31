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

    if (purchasesResult.rows.length === 0) {
      return createSuccessResponse([], 200, CORS_HEADERS);
    }

    // Для каждой покупки получаем информацию об альбоме и треках
    const purchases: Purchase[] = await Promise.all(
      purchasesResult.rows.map(async (purchaseRow) => {
        // Получаем информацию об альбоме (берем первую найденную языковую версию)
        const albumResult = await query<{
          artist: string;
          album: string;
          lang: string;
        }>(`SELECT artist, album, lang FROM albums WHERE album_id = $1 LIMIT 1`, [
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

    return createSuccessResponse(purchases, 200, CORS_HEADERS);
  } catch (error) {
    console.error('❌ Error in get-my-purchases:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      email: event.queryStringParameters?.email,
    });
    return createErrorResponse(500, errorMessage);
  }
};
