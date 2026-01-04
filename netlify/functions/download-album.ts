/**
 * Netlify Function для скачивания всего альбома одним ZIP-архивом
 * GET /api/download-album?token={purchase_token}
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '@config/supabase';
import { createClient } from '@supabase/supabase-js';
import archiver from 'archiver';

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

    console.log('📦 [download-album] Creating ZIP archive for album:', {
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
    const storageUserId = 'zhoock';
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
              const headResponse = await fetch(urlData.publicUrl, { method: 'HEAD' });
              if (headResponse.ok) {
                console.log(`✅ [download-album] Found file at: ${storagePath}`);
                const fileResponse = await fetch(urlData.publicUrl);
                if (!fileResponse.ok) {
                  console.warn(
                    `⚠️ [download-album] Failed to fetch file: ${fileResponse.statusText}`
                  );
                  continue;
                }
                const fileBuffer = await fileResponse.arrayBuffer();
                const extension = fileName.split('.').pop() || 'wav';
                const archiveFileName = `${String(track.order_index).padStart(2, '0')}. ${track.title}.${extension}`;
                archive.append(Buffer.from(fileBuffer), { name: archiveFileName });
                filesAdded++;
                fileFound = true;
                break;
              }
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

    // Формируем имя файла для скачивания
    const sanitizeFileName = (name: string): string => {
      return name
        .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .trim();
    };

    const albumFileName = sanitizeFileName(`${album.artist} - ${album.album}`);
    const downloadFileName = `${albumFileName}.zip`;
    const encodedFileName = encodeURIComponent(downloadFileName);

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

    // Для локальной разработки возвращаем файл напрямую (нет лимита размера)
    // Для production используем upload в Storage + redirect
    const isLocalDev = !!process.env.NETLIFY_DEV;

    if (isLocalDev) {
      // Локальная разработка: возвращаем файл напрямую
      console.log(
        `📤 [download-album] Returning ZIP directly (local dev): ${zipBuffer.length} bytes`
      );
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
          'Content-Length': zipBuffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
        body: zipBuffer.toString('base64'),
        isBase64Encoded: true,
      };
    }

    // Production: загружаем в Storage и возвращаем redirect
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [download-album] Supabase credentials not found');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Storage service not configured' }),
      };
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Временный путь для ZIP-файла (используем purchase_token для уникальности)
    const tempStoragePath = `users/${storageUserId}/downloads/${purchaseToken}/${downloadFileName}`;

    try {
      console.log(`📤 [download-album] Uploading ZIP to storage: ${tempStoragePath}`);

      // Загружаем ZIP в Storage
      // Не указываем contentType - Supabase определит тип по расширению файла (.zip)
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(tempStoragePath, zipBuffer, {
          upsert: true, // Перезаписываем, если файл уже существует
          cacheControl: '3600', // Кэш на 1 час
        });

      if (uploadError) {
        console.error('❌ [download-album] Failed to upload ZIP to storage:', uploadError);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to upload ZIP file' }),
        };
      }

      console.log(`✅ [download-album] ZIP uploaded successfully`);

      // Получаем публичный URL
      const { data: urlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .getPublicUrl(tempStoragePath);

      if (!urlData?.publicUrl) {
        console.error('❌ [download-album] Failed to get public URL');
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to get download URL' }),
        };
      }

      console.log(`✅ [download-album] Public URL generated: ${urlData.publicUrl}`);

      // Редирект на прямой URL (избегаем ошибки 413 для больших файлов)
      return {
        statusCode: 302,
        headers: {
          Location: urlData.publicUrl,
          'Cache-Control': 'no-cache',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        },
      };
    } catch (error) {
      console.error('❌ [download-album] Error uploading ZIP:', error);
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
