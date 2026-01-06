/**
 * Netlify Background Function для сборки ZIP-архива альбома
 * Вызывается асинхронно из download-album.ts
 * Имя файла должно заканчиваться на -background для работы как background function
 * GET /api/build-album-zip-background?token={purchase_token}
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
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ [build-album-zip-background] Supabase credentials not found');
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
    console.error('❌ [build-album-zip-background] Failed to create Supabase admin client:', error);
    return null;
  }
}

export const handler: Handler = async (event: HandlerEvent) => {
  console.log('🔨 [build-album-zip-background] Handler called:', {
    method: event.httpMethod,
    path: event.path,
    queryString: event.queryStringParameters,
  });

  try {
    const purchaseToken = event.queryStringParameters?.token;
    if (!purchaseToken) {
      console.error('❌ [build-album-zip-background] Missing token parameter');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required parameter: token' }),
      };
    }

    // Проверяем, что покупка существует
    console.log(
      '🔨 [build-album-zip-background] Querying purchase with token:',
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
      console.error(
        '❌ [build-album-zip-background] Database error when querying purchase:',
        dbError
      );
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
        '❌ [build-album-zip-background] Purchase not found for token:',
        purchaseToken.substring(0, 8) + '...'
      );
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Purchase not found or invalid token' }),
      };
    }

    const purchase = purchaseResult.rows[0];
    console.log('🔨 [build-album-zip-background] Purchase found:', { albumId: purchase.album_id });

    // Получаем информацию об альбоме
    console.log('🔨 [build-album-zip-background] Querying album:', purchase.album_id);
    let albumResult;
    try {
      albumResult = await query<{
        artist: string;
        album: string;
        lang: string;
      }>(`SELECT artist, album, lang FROM albums WHERE album_id = $1 LIMIT 1`, [purchase.album_id]);
    } catch (dbError) {
      console.error('❌ [build-album-zip-background] Database error when querying album:', dbError);
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
      console.error('❌ [build-album-zip-background] Album not found:', purchase.album_id);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Album not found' }),
      };
    }

    const album = albumResult.rows[0];
    console.log('🔨 [build-album-zip-background] Album found:', {
      artist: album.artist,
      album: album.album,
      lang: album.lang,
    });

    // Получаем все треки альбома
    console.log(
      '🔨 [build-album-zip-background] Querying tracks for album:',
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
      console.error(
        '❌ [build-album-zip-background] Database error when querying tracks:',
        dbError
      );
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

    // Формируем имя файла для Storage (ASCII)
    const storageZipFileName = `album-${purchase.album_id}.zip`;
    const storageUserId = 'zhoock';
    const folder = `users/${storageUserId}/album-zips/${purchase.id}`;
    const lockName = 'building.lock';
    const zipStoragePath = `${folder}/${storageZipFileName}`;

    console.log('🔨 [build-album-zip-background] Creating archive:', {
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
        console.log('✅ [build-album-zip-background] Archive finalized');
        resolve();
      });
      archive.on('error', (err) => {
        console.error('❌ [build-album-zip-background] Archive error:', err);
        reject(err);
      });
    });

    const supabase = createSupabaseClient();
    let filesAdded = 0;

    // Добавляем каждый трек в архив
    for (const track of tracksResult.rows) {
      if (!track.src) {
        console.warn(
          `⚠️ [build-album-zip-background] Track ${track.track_id} has no src, skipping`
        );
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
              `⚠️ [build-album-zip-background] Failed to fetch ${track.track_id}: ${fileResponse.statusText}`
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
          console.warn(`⚠️ [build-album-zip-background] Error fetching ${track.track_id}:`, error);
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
                console.log(`✅ [build-album-zip-background] Found file at: ${storagePath}`);
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
            console.warn(
              `⚠️ [build-album-zip-background] Error checking path ${storagePath}:`,
              error
            );
          }
        }
      }

      if (!fileFound) {
        console.warn(
          `⚠️ [build-album-zip-background] File not found for track ${track.track_id}: ${track.title}`
        );
      }
    }

    // Завершаем архив и ждем завершения
    archive.finalize();
    await archivePromise;

    if (filesAdded === 0) {
      console.error('❌ [build-album-zip-background] No track files found to download');
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No track files found to download' }),
      };
    }

    // Объединяем все chunks в один Buffer
    const zipBuffer = Buffer.concat(chunks);

    console.log(
      `✅ [build-album-zip-background] ZIP archive created: ${filesAdded} files, ${zipBuffer.length} bytes`
    );

    // Загружаем ZIP в Storage
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      console.error('❌ [build-album-zip-background] Failed to create Supabase admin client');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Storage service not configured' }),
      };
    }

    try {
      // Загружаем ZIP в Storage (upsert перезапишет, если файл уже существует)
      console.log(`📤 [build-album-zip-background] Uploading ZIP to storage: ${zipStoragePath}`);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(zipStoragePath, zipBuffer, {
          upsert: true, // Перезаписываем, если файл уже существует
          cacheControl: '3600', // Кэш на 1 час
          contentType: 'application/zip', // ✅ Явно указываем MIME тип
        });

      if (uploadError) {
        console.error(
          '❌ [build-album-zip-background] Failed to upload ZIP to storage:',
          uploadError
        );
        // ✅ Удаляем lock-файл при ошибке загрузки
        try {
          await supabaseAdmin.storage.from(STORAGE_BUCKET_NAME).remove([`${folder}/${lockName}`]);
          console.log(`✅ [build-album-zip-background] Lock file removed after error`);
        } catch (lockError) {
          console.warn(
            `⚠️ [build-album-zip-background] Failed to remove lock file: ${lockError instanceof Error ? lockError.message : String(lockError)}`
          );
        }
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Failed to upload ZIP file',
            details: uploadError.message,
          }),
        };
      }

      console.log(`✅ [build-album-zip-background] ZIP uploaded successfully to storage`);

      // ✅ Удаляем lock-файл после успешной загрузки
      try {
        await supabaseAdmin.storage.from(STORAGE_BUCKET_NAME).remove([`${folder}/${lockName}`]);
        console.log(`✅ [build-album-zip-background] Lock file removed`);
      } catch (lockError) {
        console.warn(
          `⚠️ [build-album-zip-background] Failed to remove lock file: ${lockError instanceof Error ? lockError.message : String(lockError)}`
        );
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'ZIP archive built and uploaded' }),
      };
    } catch (error) {
      console.error('❌ [build-album-zip-background] Error in storage operations:', error);
      // ✅ Удаляем lock-файл при ошибке
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.storage.from(STORAGE_BUCKET_NAME).remove([`${folder}/${lockName}`]);
          console.log(`✅ [build-album-zip-background] Lock file removed after error`);
        } catch (lockError) {
          console.warn(
            `⚠️ [build-album-zip-background] Failed to remove lock file: ${lockError instanceof Error ? lockError.message : String(lockError)}`
          );
        }
      }
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
      };
    }
  } catch (error) {
    console.error('❌ Error in build-album-zip-background:', error);
    // ✅ Пытаемся удалить lock-файл при общей ошибке (если purchase был получен)
    try {
      const purchaseToken = event.queryStringParameters?.token;
      if (purchaseToken) {
        const purchaseResult = await query<{ id: string }>(
          `SELECT id FROM purchases WHERE purchase_token = $1 LIMIT 1`,
          [purchaseToken]
        );
        if (purchaseResult.rows.length > 0) {
          const purchase = purchaseResult.rows[0];
          const storageUserId = 'zhoock';
          const folder = `users/${storageUserId}/album-zips/${purchase.id}`;
          const lockName = 'building.lock';
          const supabaseAdmin = createSupabaseAdminClient();
          if (supabaseAdmin) {
            await supabaseAdmin.storage.from(STORAGE_BUCKET_NAME).remove([`${folder}/${lockName}`]);
            console.log(`✅ [build-album-zip-background] Lock file removed after general error`);
          }
        }
      }
    } catch (lockError) {
      // Игнорируем ошибку удаления lock-файла
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
