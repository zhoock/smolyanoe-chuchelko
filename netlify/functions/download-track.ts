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

    console.log('🔍 [download-track] Track info:', {
      trackId,
      albumId: purchase.album_id,
      src: track.src,
      title: track.title,
    });

    // Если src - это уже полный URL, используем его
    if (audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'))) {
      console.log('✅ [download-track] Using direct URL:', audioUrl);
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

    if (!audioUrl) {
      console.error('❌ [download-track] Track src is empty');
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Track file path not found in database' }),
      };
    }

    // Если src - относительный путь, конвертируем в Supabase Storage URL
    // Формат пути может быть:
    // - "/audio/23/01-Barnums-Fijian-Mermaid-1644.wav"
    // - "/audio/23-Remastered/01-Barnums-Fijian-Mermaid-1644.wav"
    // - "23/01-Barnums-Fijian-Mermaid-1644.wav"
    // - Полный URL из Supabase Storage (уже обработан выше)

    // Убираем ведущий слеш и префикс /audio/ если есть
    let normalizedPath = audioUrl.trim();
    if (normalizedPath.startsWith('/audio/')) {
      normalizedPath = normalizedPath.slice(7); // Убираем "/audio/"
    } else if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.slice(1); // Убираем ведущий "/"
    }

    // Используем 'zhoock' как userId для единообразия
    const storageUserId = 'zhoock';

    // Извлекаем имя файла из пути
    // Путь может быть: "23/01-track.wav" или "23-Remastered/01-track.wav"
    const fileName = normalizedPath.includes('/')
      ? normalizedPath.split('/').pop() || normalizedPath
      : normalizedPath;

    // Пробуем несколько вариантов путей, так как album_id может отличаться от реальной папки
    // Варианты: с разными регистрами, с дефисами/подчеркиваниями, оригинальный путь из БД
    const albumIdVariants = [
      purchase.album_id, // "23-remastered"
      purchase.album_id.replace(/-remastered/i, '-Remastered'), // "23-Remastered"
      purchase.album_id.replace(/-remastered/i, 'Remastered'), // "23Remastered"
      purchase.album_id.replace(/-/g, '_'), // "23_remastered"
    ];

    const possiblePaths = [
      // Основные варианты с album_id
      ...albumIdVariants.map((albumId) => `users/${storageUserId}/audio/${albumId}/${fileName}`),
      // Оригинальный путь из БД (если он содержит полный путь)
      `users/${storageUserId}/audio/${normalizedPath}`,
      // Если normalizedPath уже содержит users/zhoock/audio, используем его как есть
      normalizedPath.startsWith('users/') ? normalizedPath : null,
    ].filter((path): path is string => path !== null);

    console.log('🔍 [download-track] Trying paths:', possiblePaths);

    // Пробуем получить публичный URL из Supabase Storage
    const supabase = createSupabaseClient();
    if (supabase) {
      // Пробуем каждый возможный путь
      for (const storagePath of possiblePaths) {
        console.log(`🔍 [download-track] Trying path: ${storagePath}`);
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .getPublicUrl(storagePath);

        if (urlData?.publicUrl) {
          // Проверяем, что файл действительно существует (делаем HEAD запрос)
          try {
            const headResponse = await fetch(urlData.publicUrl, { method: 'HEAD' });
            if (headResponse.ok) {
              console.log(`✅ [download-track] Found file at: ${storagePath}`);
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
            } else {
              console.log(
                `⚠️ [download-track] File not found at: ${storagePath} (${headResponse.status})`
              );
            }
          } catch (fetchError) {
            console.log(`⚠️ [download-track] Error checking file at: ${storagePath}`, fetchError);
          }
        }
      }
    }

    // Если не удалось получить URL, возвращаем ошибку
    console.error('❌ [download-track] Failed to get track URL:', {
      trackId,
      albumId: purchase.album_id,
      src: track.src,
      triedPaths: possiblePaths,
    });

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Track file not found in storage',
        details: {
          trackId,
          albumId: purchase.album_id,
          src: track.src,
          triedPaths: possiblePaths,
        },
      }),
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
