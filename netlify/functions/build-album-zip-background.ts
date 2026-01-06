/**
 * Netlify Background Function для сборки ZIP-архива альбома
 * Вызывается асинхронно из download-album.ts
 * Имя файла должно заканчиваться на -background для работы как background function
 * GET /api/build-album-zip-background?token={purchase_token}
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createSupabaseAdminClient,
  createSupabaseAnonClient,
  STORAGE_BUCKET_NAME,
} from './lib/supabase';
import archiver from 'archiver';

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

    // ✅ Определяем пути для lock и error файлов (нужны для finally)
    const storageUserId = 'zhoock';
    const folder = `users/${storageUserId}/album-zips/${purchase.id}`;
    const lockName = 'building.lock';
    const errorFileName = 'error.json';
    const supabaseAdmin = createSupabaseAdminClient();

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
    const zipStoragePath = `${folder}/${storageZipFileName}`;

    console.log('🔨 [build] Started', {
      token: purchaseToken.substring(0, 8),
      albumId: purchase.album_id,
      albumName: album.album,
      tracksCount: tracksResult.rows.length,
    });

    // ✅ Функция санитизации имени файла
    const sanitizeFileName = (name: string): string => {
      return name
        .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '_')
        .replace(/_{2,}/g, '_')
        .trim();
    };

    // ✅ Надёжное получение расширения из URL (без query параметров)
    const getExtensionFromUrl = (url: string): string => {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = pathname.split('.').pop();
        return ext || 'wav';
      } catch {
        // Если не URL, пробуем просто split
        const parts = url.split('?')[0].split('.');
        return parts.length > 1 ? parts.pop() || 'wav' : 'wav';
      }
    };

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

    // Используем admin client для скачивания файлов (работает с приватными bucket)
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
              `⚠️ [build] Failed to fetch ${track.track_id}: ${fileResponse.statusText}`
            );
            continue;
          }
          const fileBuffer = await fileResponse.arrayBuffer();
          const extension = getExtensionFromUrl(audioUrl);
          const safeTitle = sanitizeFileName(track.title);
          const archiveFileName = `${String(track.order_index).padStart(2, '0')}. ${safeTitle}.${extension}`;
          archive.append(Buffer.from(fileBuffer), { name: archiveFileName });
          filesAdded++;
          continue;
        } catch (error) {
          console.warn(`⚠️ [build] Error fetching ${track.track_id}:`, error);
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
      if (supabaseAdmin) {
        for (const storagePath of possiblePaths) {
          try {
            // ✅ Используем storage.download вместо getPublicUrl + fetch (работает с приватными bucket)
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage
              .from(STORAGE_BUCKET_NAME)
              .download(storagePath);

            if (!downloadError && fileData) {
              console.log(`✅ [build] Found file at: ${storagePath}`);
              const arrayBuffer = await fileData.arrayBuffer();
              const extension = getExtensionFromUrl(fileName) || 'wav';
              const safeTitle = sanitizeFileName(track.title);
              const archiveFileName = `${String(track.order_index).padStart(2, '0')}. ${safeTitle}.${extension}`;
              archive.append(Buffer.from(arrayBuffer), { name: archiveFileName });
              filesAdded++;
              fileFound = true;
              break;
            }
            // Если ошибка, пробуем следующий путь
          } catch (error) {
            console.warn(`⚠️ [build] Error checking path ${storagePath}:`, error);
          }
        }
      }

      if (!fileFound) {
        console.warn(`⚠️ [build] File not found for track ${track.track_id}: ${track.title}`);
      }
    }

    // Завершаем архив и ждем завершения
    archive.finalize();
    await archivePromise;

    if (filesAdded === 0) {
      throw new Error('No track files found to download');
    }

    // Объединяем все chunks в один Buffer
    const zipBuffer = Buffer.concat(chunks);

    console.log(`✅ [build] Archive created: ${filesAdded} files, ${zipBuffer.length} bytes`);

    if (!supabaseAdmin) {
      throw new Error('Storage service not configured');
    }

    // Загружаем ZIP в Storage
    console.log(`📤 [build] Uploading ZIP to storage: ${zipStoragePath}`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(zipStoragePath, zipBuffer, {
        upsert: true,
        cacheControl: '3600',
        contentType: 'application/zip',
      });

    if (uploadError) {
      throw new Error(`Failed to upload ZIP file: ${uploadError.message}`);
    }

    console.log(`✅ [build] ZIP uploaded successfully`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'ZIP archive built and uploaded' }),
    };
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    console.error('❌ [build] Failed:', errorMessage);

    // ✅ Записываем error.json для остановки бесконечного polling
    try {
      const purchaseToken = event.queryStringParameters?.token;
      if (purchaseToken) {
        let purchaseId: string | undefined;
        try {
          const purchaseResult = await query<{ id: string }>(
            `SELECT id FROM purchases WHERE purchase_token = $1 LIMIT 1`,
            [purchaseToken]
          );
          if (purchaseResult.rows.length > 0) {
            purchaseId = purchaseResult.rows[0].id;
          }
        } catch {
          // Игнорируем ошибку получения purchase
        }

        if (purchaseId) {
          const storageUserId = 'zhoock';
          const folder = `users/${storageUserId}/album-zips/${purchaseId}`;
          const errorFileName = 'error.json';
          const errorContent = JSON.stringify({
            message: errorMessage,
            timestamp: new Date().toISOString(),
          });

          const supabaseAdmin = createSupabaseAdminClient();
          if (supabaseAdmin) {
            await supabaseAdmin.storage
              .from(STORAGE_BUCKET_NAME)
              .upload(`${folder}/${errorFileName}`, Buffer.from(errorContent), {
                upsert: true,
                contentType: 'application/json',
                cacheControl: '0',
              });
            console.log(`✅ [build] Error.json written`);
          }
        }
      }
    } catch (errorJsonError) {
      console.warn(`⚠️ [build] Failed to write error.json:`, errorJsonError);
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Build failed', details: errorMessage }),
    };
  } finally {
    // ✅ ОБЯЗАТЕЛЬНО: удаляем lock в любом случае
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
            console.log(`🔓 [build] Lock removed`);
          }
        }
      }
    } catch (lockError) {
      console.warn(`⚠️ [build] Failed to remove lock in finally:`, lockError);
    }
  }
};
