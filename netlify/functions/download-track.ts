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
      user_id?: string;
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

    // Определяем userId для Storage из альбома (для скачивания покупок не нужен токен)
    let storageUserId: string | null = null;

    if (purchase.album_id) {
      const albumResult = await query<{ user_id: string | null }>(
        `SELECT user_id FROM albums WHERE album_id = $1 LIMIT 1`,
        [purchase.album_id]
      );
      if (albumResult.rows.length > 0 && albumResult.rows[0].user_id) {
        storageUserId = albumResult.rows[0].user_id;
      }
    }

    if (!storageUserId) {
      // Fallback: используем старую папку 'zhoock' для обратной совместимости
      // TODO: Убрать после полной миграции
      console.warn('⚠️ [download-track] User ID not found, using fallback');
      storageUserId = 'zhoock';
    }

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
      storageUserId,
    });

    if (!audioUrl) {
      console.error('❌ [download-track] Track src is empty');
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Track file path not found in database' }),
      };
    }

    // Если src - это уже полный URL, пробуем его использовать
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      console.log('🔍 [download-track] Track src is a full URL, checking if it works...');
      try {
        const headResponse = await fetch(audioUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          console.log('✅ [download-track] Direct URL works:', audioUrl);
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
        } else {
          console.log(
            `⚠️ [download-track] Direct URL failed (${headResponse.status}), will try to extract path from URL`
          );
          // Пытаемся извлечь путь из URL
          try {
            const urlObj = new URL(audioUrl);
            // Формат: https://...supabase.co/storage/v1/object/public/user-media/users/{userId}/audio/...
            const pathMatch = urlObj.pathname.match(/\/user-media\/(.+)/);
            if (pathMatch && pathMatch[1]) {
              audioUrl = pathMatch[1]; // Извлекаем путь: users/{userId}/audio/...
              console.log('✅ [download-track] Extracted path from URL:', audioUrl);
            }
          } catch (urlError) {
            console.log('⚠️ [download-track] Failed to parse URL, will try as relative path');
          }
        }
      } catch (fetchError) {
        console.log('⚠️ [download-track] Error checking direct URL, will try to extract path');
        // Пытаемся извлечь путь из URL
        try {
          const urlObj = new URL(audioUrl);
          const pathMatch = urlObj.pathname.match(/\/user-media\/(.+)/);
          if (pathMatch && pathMatch[1]) {
            audioUrl = pathMatch[1];
            console.log('✅ [download-track] Extracted path from URL:', audioUrl);
          }
        } catch (urlError) {
          console.log('⚠️ [download-track] Failed to parse URL');
        }
      }
    }

    // Теперь audioUrl должен быть либо относительным путем, либо путем вида users/{userId}/audio/...
    // Убираем ведущий слеш и префикс /audio/ если есть
    let normalizedPath = audioUrl.trim();
    if (normalizedPath.startsWith('/audio/')) {
      normalizedPath = normalizedPath.slice(7); // Убираем "/audio/" -> "23-Remastered/01-Barnums-Fijian-Mermaid-1644.wav"
    } else if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.slice(1); // Убираем ведущий "/"
    }

    // Пробуем несколько вариантов путей
    const possiblePaths: string[] = [];

    // Если путь уже содержит users/{userId}/audio, обновляем userId если нужно
    if (normalizedPath.startsWith('users/')) {
      // Извлекаем текущий userId из пути
      const pathParts = normalizedPath.split('/');
      if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === 'audio') {
        const oldUserId = pathParts[1];
        // Заменяем userId на правильный
        const newPath = `users/${storageUserId}/audio/${pathParts.slice(3).join('/')}`;
        // Сначала пробуем путь с правильным userId
        possiblePaths.push(newPath);
        // Также пробуем оригинальный путь, если userId отличается
        if (oldUserId !== storageUserId) {
          possiblePaths.push(normalizedPath);
        }
      } else {
        possiblePaths.push(normalizedPath);
      }
    } else {
      // Оригинальный путь из БД (приоритет, так как он содержит правильное имя папки)
      if (normalizedPath) {
        possiblePaths.push(`users/${storageUserId}/audio/${normalizedPath}`);
      }

      // Извлекаем имя файла и пробуем разные варианты album_id
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
      possiblePaths.push(
        ...albumIdVariants.map((albumId) => `users/${storageUserId}/audio/${albumId}/${fileName}`)
      );
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
