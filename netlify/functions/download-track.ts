/**
 * Netlify Function для скачивания треков по токену покупки
 * GET /api/download?token={purchase_token}&track={track_id}
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '../../src/config/supabase';
import { getUserIdFromEvent } from './lib/api-helpers';

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

    console.log('🔍 [download-track] Request received:', {
      purchaseToken,
      trackId,
      hasToken: !!purchaseToken,
      tokenLength: purchaseToken?.length,
      queryParams: event.queryStringParameters,
    });

    if (!purchaseToken || !trackId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameters: token and track' }),
      };
    }

    // Проверяем, что покупка существует
    console.log('🔍 [download-track] Searching for purchase with token:', purchaseToken);
    const purchaseResult = await query<{
      id: string;
      album_id: string;
      customer_email: string;
      user_id?: string;
    }>(`SELECT id, album_id, customer_email FROM purchases WHERE purchase_token = $1::uuid`, [
      purchaseToken,
    ]);

    console.log('🔍 [download-track] Purchase query result:', {
      rowsCount: purchaseResult.rows.length,
      found: purchaseResult.rows.length > 0,
      purchaseId: purchaseResult.rows[0]?.id,
      albumId: purchaseResult.rows[0]?.album_id,
      customerEmail: purchaseResult.rows[0]?.customer_email,
    });

    if (purchaseResult.rows.length === 0) {
      console.error('❌ [download-track] Purchase not found:', {
        purchaseToken,
        tokenLength: purchaseToken.length,
        tokenFormat: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          purchaseToken
        )
          ? 'valid UUID format'
          : 'invalid UUID format',
      });
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Purchase not found or invalid token' }),
      };
    }

    const purchase = purchaseResult.rows[0];

    const trackResult = await query<{
      src: string | null;
      title: string;
      album_id: string;
      album_user_id: string | null;
    }>(
      `SELECT t.src, t.title, a.album_id, a.user_id AS album_user_id
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

    // Папка в Storage: JWT (если есть) или владелец альбома из БД
    const storageUserId = getUserIdFromEvent(event) || track.album_user_id || null;
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
      normalizedPath = normalizedPath.slice(7); // Убираем "/audio/" -> "23-Remastered/01-Barnums-Fijian-Mermaid-1644.wav"
    } else if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.slice(1); // Убираем ведущий "/"
    }

    if (!storageUserId && !normalizedPath.startsWith('users/')) {
      console.error(
        '❌ [download-track] Cannot resolve storage user (need JWT or album.user_id, or full users/... path)'
      );
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Track storage path cannot be resolved (album owner missing)',
        }),
      };
    }

    // Пробуем несколько вариантов путей
    // 1. Используем оригинальный путь из БД (normalizedPath уже содержит правильную папку, например "23-Remastered/01-track.wav")
    // 2. Пробуем варианты с album_id из покупки
    const possiblePaths: string[] = [];

    // Вариант 1: Оригинальный путь из БД (приоритет, так как он содержит правильное имя папки)
    if (normalizedPath && storageUserId) {
      possiblePaths.push(`users/${storageUserId}/audio/${normalizedPath}`);
    }

    // Вариант 2: Извлекаем имя файла и пробуем разные варианты album_id
    const fileName = normalizedPath.includes('/')
      ? normalizedPath.split('/').pop() || normalizedPath
      : normalizedPath;

    // Варианты album_id с разными регистрами и форматами
    const albumIdVariants = [
      purchase.album_id, // "23-remastered"
      purchase.album_id.replace(/-remastered/i, '-Remastered'), // "23-Remastered"
      purchase.album_id.replace(/-remastered/i, ' Remastered'), // "23 Remastered" (с пробелом)
      purchase.album_id.replace(/-remastered/i, 'Remastered'), // "23Remastered"
      purchase.album_id.replace(/-/g, '_'), // "23_remastered"
      '23-Remastered', // Прямой вариант с заглавной R
      '23 Remastered', // С пробелом
    ];

    // Добавляем варианты с album_id
    if (storageUserId) {
      possiblePaths.push(
        ...albumIdVariants.map((albumId) => `users/${storageUserId}/audio/${albumId}/${fileName}`)
      );
    }

    // Уже полный путь внутри bucket (в т.ч. легаси-префиксы)
    if (normalizedPath.startsWith('users/')) {
      possiblePaths.push(normalizedPath);
    }

    // Убираем дубликаты
    const uniquePaths = [...new Set(possiblePaths)];

    console.log('🔍 [download-track] Trying paths:', uniquePaths);

    // Пробуем получить публичный URL из Supabase Storage
    const supabase = createSupabaseClient();
    if (supabase) {
      // Пробуем каждый возможный путь
      for (const storagePath of uniquePaths) {
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

              // Редирект на прямой URL из Supabase Storage (избегаем ошибки 413 для больших файлов)
              return {
                statusCode: 302,
                headers: {
                  Location: urlData.publicUrl,
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
