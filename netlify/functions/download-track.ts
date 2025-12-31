/**
 * Netlify Function для скачивания треков по токену покупки
 * GET /api/download?token={purchase_token}&track={track_id}
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '@config/supabase';

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body?: string }> => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed. Use GET.' }),
    };
  }

  try {
    const purchaseToken = event.queryStringParameters?.token;
    const trackId = event.queryStringParameters?.track;

    if (!purchaseToken || !trackId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameters: token and track' }),
      };
    }

    // Проверяем, что покупка существует
    const purchaseResult = await query<{
      id: string;
      album_id: string;
      customer_email: string;
    }>(`SELECT id, album_id, customer_email FROM purchases WHERE purchase_token = $1`, [
      purchaseToken,
    ]);

    if (purchaseResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Purchase not found or invalid token' }),
      };
    }

    const purchase = purchaseResult.rows[0];

    // Получаем информацию о треке
    const trackResult = await query<{
      src: string | null;
      title: string;
      album_id: string;
    }>(
      `SELECT t.src, t.title, a.album_id
       FROM tracks t
       INNER JOIN albums a ON t.album_id = a.id
       WHERE a.album_id = $1 AND t.track_id = $2
       LIMIT 1`,
      [purchase.album_id, trackId]
    );

    if (trackResult.rows.length === 0 || !trackResult.rows[0].src) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Track not found' }),
      };
    }

    const track = trackResult.rows[0];
    let audioUrl = track.src;

    // Если src - это уже полный URL, используем его
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      // Обновляем счетчик скачиваний (не блокируем ответ)
      query(
        `UPDATE purchases 
         SET download_count = download_count + 1, 
             last_downloaded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [purchase.id]
      ).catch((error) => {
        console.error('❌ Failed to update download count:', error);
      });

      // Редирект на прямой URL
      return {
        statusCode: 302,
        headers: {
          Location: audioUrl,
          'Cache-Control': 'no-cache',
        },
      };
    }

    // Если src - относительный путь, конвертируем в Supabase Storage URL
    // Формат пути может быть:
    // - "/audio/23/01-Barnums-Fijian-Mermaid-1644.wav"
    // - "23/01-Barnums-Fijian-Mermaid-1644.wav"
    // - Полный URL из Supabase Storage (уже обработан выше)
    let normalizedPath = audioUrl.startsWith('/audio/') ? audioUrl.slice(7) : audioUrl;

    // Используем 'zhoock' как userId для единообразия
    const storageUserId = 'zhoock';

    // Если путь содержит подпапки (например "23/01-track.wav"), берем имя файла
    // Иначе используем путь как есть
    const fileName = normalizedPath.includes('/')
      ? normalizedPath.split('/').pop() || normalizedPath
      : normalizedPath;

    const storagePath = `users/${storageUserId}/audio/${purchase.album_id}/${fileName}`;

    // Пробуем получить публичный URL из Supabase Storage
    const supabase = createSupabaseClient();
    if (supabase) {
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .getPublicUrl(storagePath);
      if (urlData?.publicUrl) {
        audioUrl = urlData.publicUrl;

        // Обновляем счетчик скачиваний (не блокируем ответ)
        query(
          `UPDATE purchases 
           SET download_count = download_count + 1, 
               last_downloaded_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [purchase.id]
        ).catch((error) => {
          console.error('❌ Failed to update download count:', error);
        });

        // Редирект на Supabase Storage URL
        return {
          statusCode: 302,
          headers: {
            Location: audioUrl,
            'Cache-Control': 'no-cache',
          },
        };
      }
    }

    // Если не удалось получить URL, возвращаем ошибку
    console.error('❌ Failed to get track URL:', {
      trackId,
      albumId: purchase.album_id,
      src: track.src,
      storagePath,
    });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to get track URL' }),
    };
  } catch (error) {
    console.error('❌ Error in download-track:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
