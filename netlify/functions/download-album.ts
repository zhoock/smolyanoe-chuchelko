/**
 * Netlify Function для скачивания всего альбома одним ZIP-архивом
 * GET /api/download-album?token={purchase_token}
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '../../src/config/supabase';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';

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

    // Получаем все треки альбома
    console.log(
      '📦 [download-album] Querying tracks for album:',
      purchase.album_id,
      'lang:',
      album.lang
    );
    let tracksResult;
    try {
      tracksResult = await query<{
        track_id: string;
        title: string;
        src: string | null;
        order_index: number;
      }>(
        `SELECT t.track_id, t.title, t.src, t.order_index
       FROM tracks t
       INNER JOIN albums a ON t.album_id = a.id
       WHERE a.album_id = $1 AND a.lang = $2
       ORDER BY t.order_index ASC`,
        [purchase.album_id, album.lang]
      );
    } catch (dbError) {
      console.error('❌ [download-album] Database error when querying tracks:', dbError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Database error when fetching tracks',
          details: dbError instanceof Error ? dbError.message : String(dbError),
        }),
      };
    }

    if (tracksResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No tracks found for this album' }),
      };
    }

    // Формируем имя файла для скачивания
    // ✅ Оставляем пробелы и дефисы, убираем только опасные символы
    const sanitizeFileName = (name: string): string => {
      return name
        .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_') // Убираем опасные символы
        .replace(/_{2,}/g, '_') // Убираем множественные подчеркивания
        .trim();
    };

    const albumFileName = sanitizeFileName(`${album.artist} - ${album.album}`);
    const downloadFileName = `${albumFileName}.zip`;

    // Используем 'zhoock' для единообразия с фронтендом
    const storageUserId = 'zhoock';

    // Путь для ZIP файла в Storage (используем purchase.id для уникальности и кэширования)
    const zipStoragePath = `users/${storageUserId}/album-zips/${purchase.id}/${downloadFileName}`;

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
    console.log(`🔍 [download-album] Checking for existing ZIP in folder: ${folder}`);

    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET_NAME)
      .list(folder, { limit: 100 });

    if (listError) {
      console.log(
        `ℹ️ [download-album] Could not list folder (will create ZIP): ${listError.message}`
      );
    } else {
      const exists = !!listData?.some((f) => f.name === downloadFileName);

      if (exists) {
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
          console.log(`✅ [download-album] Returning cached ZIP, skipping archive creation`);
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
      } else {
        console.log(`ℹ️ [download-album] ZIP not found in folder, will create new archive`);
      }
    }

    // ZIP не найден — собираем архив
    console.log('📦 [download-album] ZIP not found, creating archive:', {
      albumId: purchase.album_id,
      albumName: album.album,
      tracksCount: tracksResult.rows.length,
    });

    // Создаем ZIP архив
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Максимальное сжатие
    });

    // Собираем все chunks архива в массив
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Создаем Promise для ожидания завершения архива
    const archivePromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => {
        console.log('✅ [download-album] Archive finalized');
        resolve();
      });
      archive.on('error', (err) => {
        console.error('❌ [download-album] Archive error:', err);
        reject(err);
      });
    });

    const supabase = createSupabaseClient();
    let filesAdded = 0;

    // Добавляем каждый трек в архив
    for (const track of tracksResult.rows) {
      if (!track.src) {
        console.warn(`⚠️ [download-album] Track ${track.track_id} has no src, skipping`);
        continue;
      }

      let audioUrl = track.src;
      let normalizedPath = audioUrl.trim();

      // Если src - это уже полный URL, используем его
      if (audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'))) {
        try {
          const fileResponse = await fetch(audioUrl);
          if (!fileResponse.ok) {
            console.warn(
              `⚠️ [download-album] Failed to fetch ${track.track_id}: ${fileResponse.statusText}`
            );
            continue;
          }
          const fileBuffer = await fileResponse.arrayBuffer();
          const extension = track.src.split('.').pop() || 'wav';
          const fileName = `${String(track.order_index).padStart(2, '0')}. ${track.title}.${extension}`;
          archive.append(Buffer.from(fileBuffer), { name: fileName });
          filesAdded++;
          continue;
        } catch (error) {
          console.warn(`⚠️ [download-album] Error fetching ${track.track_id}:`, error);
          continue;
        }
      }

      // Нормализуем путь для Supabase Storage
      if (normalizedPath.startsWith('/audio/')) {
        normalizedPath = normalizedPath.slice(7);
      } else if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.slice(1);
      }

      const fileName = normalizedPath.includes('/')
        ? normalizedPath.split('/').pop() || normalizedPath
        : normalizedPath;

      // Пробуем несколько вариантов путей (как в download-track)
      const albumIdVariants = [
        purchase.album_id,
        purchase.album_id.replace(/-remastered/i, '-Remastered'),
        purchase.album_id.replace(/-remastered/i, ' Remastered'),
        purchase.album_id.replace(/-remastered/i, 'Remastered'),
        purchase.album_id.replace(/-/g, '_'),
        '23-Remastered',
        '23 Remastered',
      ];

      const possiblePaths = [
        `users/${storageUserId}/audio/${normalizedPath}`,
        ...albumIdVariants.map((albumId) => `users/${storageUserId}/audio/${albumId}/${fileName}`),
      ];

      let fileFound = false;
      if (supabase) {
        for (const storagePath of possiblePaths) {
          try {
            const { data: urlData } = supabase.storage
              .from(STORAGE_BUCKET_NAME)
              .getPublicUrl(storagePath);

            if (urlData?.publicUrl) {
              // ✅ Убрали HEAD, делаем сразу GET (быстрее)
              const fileResponse = await fetch(urlData.publicUrl);
              if (fileResponse.ok) {
                console.log(`✅ [download-album] Found file at: ${storagePath}`);
                const fileBuffer = await fileResponse.arrayBuffer();
                const extension = fileName.split('.').pop() || 'wav';
                const archiveFileName = `${String(track.order_index).padStart(2, '0')}. ${track.title}.${extension}`;
                archive.append(Buffer.from(fileBuffer), { name: archiveFileName });
                filesAdded++;
                fileFound = true;
                break;
              }
              // Если 404, пробуем следующий путь
            }
          } catch (error) {
            console.warn(`⚠️ [download-album] Error checking path ${storagePath}:`, error);
          }
        }
      }

      if (!fileFound) {
        console.warn(
          `⚠️ [download-album] File not found for track ${track.track_id}: ${track.title}`
        );
      }
    }

    // Завершаем архив и ждем завершения
    archive.finalize();
    await archivePromise;

    if (filesAdded === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No track files found to download' }),
      };
    }

    // Объединяем все chunks в один Buffer
    const zipBuffer = Buffer.concat(chunks);

    console.log(
      `✅ [download-album] ZIP archive created: ${filesAdded} files, ${zipBuffer.length} bytes`
    );

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

    // Загружаем ZIP в Storage и возвращаем redirect на signed URL
    // Это решает проблему с лимитом размера ответа Netlify Functions (6MB)
    try {
      // Загружаем ZIP в Storage (upsert перезапишет, если файл уже существует)
      console.log(`📤 [download-album] Uploading ZIP to storage: ${zipStoragePath}`);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(zipStoragePath, zipBuffer, {
          upsert: true, // Перезаписываем, если файл уже существует
          cacheControl: '3600', // Кэш на 1 час
          contentType: 'application/zip', // ✅ Явно указываем MIME тип
        });

      if (uploadError) {
        console.error('❌ [download-album] Failed to upload ZIP to storage:', uploadError);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Failed to upload ZIP file',
            details: uploadError.message,
          }),
        };
      }

      console.log(`✅ [download-album] ZIP uploaded successfully to storage`);

      // Создаем signed URL (действителен 10 минут)
      console.log(`🔗 [download-album] Creating signed URL for: ${zipStoragePath}`);
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .createSignedUrl(zipStoragePath, 600); // 10 минут

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('❌ [download-album] Failed to create signed URL:', signedUrlError);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Failed to create download URL',
            details: signedUrlError?.message || 'Unknown error',
          }),
        };
      }

      console.log(`✅ [download-album] Signed URL created successfully`);

      // ✅ Добавляем параметр download к signed URL для правильного имени файла
      const url = new URL(signedUrlData.signedUrl);
      url.searchParams.set('download', downloadFileName);

      // Возвращаем redirect на signed URL (браузер скачает файл напрямую из Supabase)
      // ✅ Убрали Content-Disposition из ответа Netlify (он не применится к редиректу)
      return {
        statusCode: 302,
        headers: {
          Location: url.toString(),
          'Cache-Control': 'no-store',
        },
      };
    } catch (error) {
      console.error('❌ [download-album] Error in storage operations:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
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
