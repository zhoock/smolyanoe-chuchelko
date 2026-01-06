/**
 * Netlify Function для скачивания всего альбома одним ZIP-архивом
 * GET /api/download-album?token={purchase_token}
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { STORAGE_BUCKET_NAME } from '../../src/config/supabase';
import { createClient } from '@supabase/supabase-js';

/**
 * Создает Supabase admin client с service role key для работы с Storage
 * ⚠️ Безопасность: НЕ используем VITE_* переменные (только server env)
 */
function createSupabaseAdminClient() {
  // ✅ Только server env переменные (без VITE_*)
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ [download-album] Supabase credentials not found');
    return null;
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('❌ [download-album] Failed to create Supabase admin client:', error);
    return null;
  }
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}> => {
  console.log('📦 [download-album] Handler called:', {
    method: event.httpMethod,
    path: event.path,
    queryString: event.queryStringParameters,
  });

  if (event.httpMethod !== 'GET') {
    console.log('❌ [download-album] Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed. Use GET.' }),
    };
  }

  try {
    const purchaseToken = event.queryStringParameters?.token;
    console.log('📦 [download-album] Purchase token:', purchaseToken ? 'present' : 'missing');

    if (!purchaseToken) {
      console.error('❌ [download-album] Missing token parameter');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameter: token' }),
      };
    }

    // Проверяем, что покупка существует
    console.log(
      '📦 [download-album] Querying purchase with token:',
      purchaseToken.substring(0, 8) + '...'
    );
    let purchaseResult;
    try {
      purchaseResult = await query<{
        id: string;
        album_id: string;
        customer_email: string;
      }>(`SELECT id, album_id, customer_email FROM purchases WHERE purchase_token = $1`, [
        purchaseToken,
      ]);
    } catch (dbError) {
      console.error('❌ [download-album] Database error when querying purchase:', dbError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Database error',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        }),
      };
    }

    if (purchaseResult.rows.length === 0) {
      console.error(
        '❌ [download-album] Purchase not found for token:',
        purchaseToken.substring(0, 8) + '...'
      );
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Purchase not found or invalid token' }),
      };
    }

    const purchase = purchaseResult.rows[0];
    console.log('📦 [download-album] Purchase found:', { albumId: purchase.album_id });

    // Получаем информацию об альбоме
    console.log('📦 [download-album] Querying album:', purchase.album_id);
    let albumResult;
    try {
      albumResult = await query<{
        artist: string;
        album: string;
        lang: string;
      }>(`SELECT artist, album, lang FROM albums WHERE album_id = $1 LIMIT 1`, [purchase.album_id]);
    } catch (dbError) {
      console.error('❌ [download-album] Database error when querying album:', dbError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Database error when fetching album',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        }),
      };
    }

    if (albumResult.rows.length === 0) {
      console.error('❌ [download-album] Album not found:', purchase.album_id);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Album not found' }),
      };
    }

    const album = albumResult.rows[0];
    console.log('📦 [download-album] Album found:', {
      artist: album.artist,
      album: album.album,
      lang: album.lang,
    });

    // Формируем имя файла для скачивания (красивое имя с кириллицей)
    // ✅ Оставляем пробелы и дефисы, убираем только опасные символы
    const sanitizeFileName = (name: string): string => {
      return name
        .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_') // Убираем опасные символы
        .replace(/_{2,}/g, '_') // Убираем множественные подчеркивания
        .trim();
    };

    const albumFileName = sanitizeFileName(`${album.artist} - ${album.album}`);
    const downloadFileName = `${albumFileName}.zip`; // Красивое имя для скачивания (может быть с кириллицей)

    // ✅ ASCII-имя для Storage (Supabase не принимает кириллицу в ключах)
    const storageZipFileName = `album-${purchase.album_id}.zip`;

    // Используем 'zhoock' для единообразия с фронтендом
    const storageUserId = 'zhoock';

    // Путь для ZIP файла в Storage (используем ASCII-имя для избежания Invalid key)
    const zipStoragePath = `users/${storageUserId}/album-zips/${purchase.id}/${storageZipFileName}`;

    // 🔥 КЭШ: Надёжная проверка существования ZIP файла
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      console.error('❌ [download-album] Failed to create Supabase admin client');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Storage service not configured' }),
      };
    }

    // ✅ Сначала проверяем существование файла через list (более надёжно, чем createSignedUrl)
    const folder = `users/${storageUserId}/album-zips/${purchase.id}`;
    const lockName = 'building.lock';
    console.log(`🔍 [download-album] Checking for existing ZIP in folder: ${folder}`);

    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET_NAME)
      .list(folder, { limit: 100 });

    if (listError) {
      console.log(
        `ℹ️ [download-album] Could not list folder (will trigger build): ${listError.message}`
      );
    } else {
      // ✅ Ищем файл по ASCII-имени (в Storage файл хранится с ASCII-именем)
      const hasZip = !!listData?.some((f) => f.name === storageZipFileName);

      if (hasZip) {
        // ✅ Файл найден — создаём signed URL и возвращаем redirect
        console.log(`✅ [download-album] Found existing ZIP, creating signed URL`);
        const { data: existingSignedUrl, error: signedUrlError } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET_NAME)
          .createSignedUrl(zipStoragePath, 600);

        if (signedUrlError) {
          console.warn(
            `⚠️ [download-album] Failed to create signed URL for existing file: ${signedUrlError.message}`
          );
        } else if (existingSignedUrl?.signedUrl) {
          console.log(`✅ [download-album] Returning cached ZIP`);
          const url = new URL(existingSignedUrl.signedUrl);
          url.searchParams.set('download', downloadFileName);

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

          return {
            statusCode: 302,
            headers: {
              Location: url.toString(),
              'Cache-Control': 'no-store',
            },
          };
        }
      }

      // ✅ Проверяем lock-файл для предотвращения параллельных сборок
      const hasLock = !!listData?.some((f) => f.name === lockName);

      if (!hasLock) {
        // ✅ Создаём lock-файл перед запуском background функции
        console.log(`🔒 [download-album] Creating lock file to prevent parallel builds`);
        try {
          await supabaseAdmin.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(`${folder}/${lockName}`, Buffer.from('1'), {
              upsert: true,
              contentType: 'text/plain',
              cacheControl: '0',
            });
          console.log(`✅ [download-album] Lock file created`);

          // Определяем origin для вызова background функции
          const proto = event.headers['x-forwarded-proto'] || 'https';
          const host = event.headers.host;
          const origin = `${proto}://${host}`;

          // ✅ Запускаем background функцию (fire-and-forget)
          console.log(`🚀 [download-album] Triggering background build`);
          fetch(
            `${origin}/.netlify/functions/build-album-zip-background?token=${encodeURIComponent(purchaseToken)}`
          ).catch((error) => {
            // Логируем ошибку, но не блокируем ответ
            console.warn('⚠️ [download-album] Failed to trigger background build:', error);
          });
        } catch (lockError) {
          console.warn(
            `⚠️ [download-album] Failed to create lock file: ${lockError instanceof Error ? lockError.message : String(lockError)}`
          );
        }
      } else {
        console.log(`ℹ️ [download-album] Build already in progress (lock file exists)`);
      }
    }

    // Возвращаем 202 Accepted — ZIP собирается в фоне
    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        status: 'building',
        message: 'ZIP archive is being built. Please try again in a few moments.',
      }),
    };
  } catch (error) {
    console.error('❌ Error in download-album:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
