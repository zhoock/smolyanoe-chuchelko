/**
 * API для работы с Supabase Storage
 */

import {
  createSupabaseClient,
  createSupabaseAdminClient,
  STORAGE_BUCKET_NAME,
} from '@config/supabase';
import { CURRENT_USER_CONFIG, getUserUserId, type ImageCategory } from '@config/user';

export interface UploadFileOptions {
  userId?: string;
  category: ImageCategory;
  file: File | Blob;
  fileName: string;
  contentType?: string;
  upsert?: boolean; // Заменить файл, если существует
}

export interface GetFileUrlOptions {
  userId?: string;
  category: ImageCategory;
  fileName: string;
  expiresIn?: number; // Время жизни ссылки в секундах (по умолчанию 1 час)
}

/**
 * Получить путь к файлу в Storage
 */
function getStoragePath(userId: string, category: ImageCategory, fileName: string): string {
  // Используем UUID пользователя для всех категорий
  // Это обеспечивает правильную изоляцию данных для мультипользовательской системы

  // Обратная совместимость: если fileName уже содержит путь со старым 'zhoock', заменяем на UUID
  // Это может произойти, если fileName содержит полный путь из базы данных
  let normalizedFileName = fileName;
  if (normalizedFileName.includes('users/zhoock/')) {
    console.warn(
      '[getStoragePath] Found old path with "zhoock", replacing with UUID:',
      normalizedFileName
    );
    normalizedFileName = normalizedFileName.replace(/users\/zhoock\//g, `users/${userId}/`);
  }

  // Если fileName уже содержит полный путь (начинается с users/), возвращаем как есть
  if (normalizedFileName.startsWith('users/')) {
    return normalizedFileName;
  }

  return `users/${userId}/${category}/${normalizedFileName}`;
}

/**
 * Конвертирует File/Blob в base64 строку (без префикса data:...)
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Загрузить файл в Supabase Storage
 * @param options - опции загрузки
 * @returns URL загруженного файла или null в случае ошибки
 */
export async function uploadFile(options: UploadFileOptions): Promise<string | null> {
  try {
    // Получаем UUID текущего пользователя, или используем переданный userId, или fallback на 'zhoock'
    const defaultUserId = getUserUserId() || CURRENT_USER_CONFIG.userId;
    const { userId = defaultUserId, category, file, fileName, contentType } = options;

    const fileSizeMB = file.size / (1024 * 1024);
    console.log('📤 [uploadFile] Начало загрузки:', {
      category,
      fileName,
      fileSize: file.size,
      fileSizeMB: fileSizeMB.toFixed(2),
      fileType: file instanceof File ? file.type : 'unknown',
    });

    // Предупреждение для больших файлов (Netlify Functions имеют лимит ~6MB для body)
    if (fileSizeMB > 5) {
      console.warn(
        `⚠️ [uploadFile] Файл очень большой (${fileSizeMB.toFixed(2)}MB). Могут возникнуть проблемы с загрузкой через Netlify Function.`
      );
    }

    // Достаём токен (динамический импорт, чтобы избежать циклических зависимостей)
    const { getToken } = await import('@shared/lib/auth');
    const token = getToken();
    if (!token) {
      console.error('❌ [uploadFile] User is not authenticated. Please log in to upload files.');
      return null;
    }

    console.log('🔄 [uploadFile] Конвертация в base64...');
    const startConvert = Date.now();
    const fileBase64 = await fileToBase64(file);
    const convertTime = Date.now() - startConvert;
    console.log(
      `✅ [uploadFile] Конвертация завершена за ${convertTime}ms, размер base64: ${fileBase64.length} символов`
    );

    const payload = {
      fileBase64,
      fileName,
      userId,
      category,
      contentType: contentType || (file instanceof File ? file.type : 'image/jpeg'),
      originalFileSize: file.size,
      originalFileName: file instanceof File ? file.name : undefined,
    };

    const payloadSizeMB = JSON.stringify(payload).length / (1024 * 1024);
    console.log('📡 [uploadFile] Отправка запроса к /api/upload-file...', {
      payloadSize: JSON.stringify(payload).length,
      payloadSizeMB: payloadSizeMB.toFixed(2),
      fileName,
      category,
    });

    if (payloadSizeMB > 5.5) {
      console.error(
        `❌ [uploadFile] Payload слишком большой (${payloadSizeMB.toFixed(2)}MB). Превышен лимит Netlify Function (~6MB).`
      );
      throw new Error(
        `Файл слишком большой для загрузки через эту функцию (${(file.size / (1024 * 1024)).toFixed(2)}MB). Максимальный размер: ~5MB.`
      );
    }

    const startFetch = Date.now();
    const response = await fetch('/api/upload-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const fetchTime = Date.now() - startFetch;
    console.log(`⏱️ [uploadFile] Запрос выполнен за ${fetchTime}ms, status: ${response.status}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        const text = await response.text().catch(() => 'Unable to read response');
        errorData = { error: `HTTP ${response.status}: ${text}` };
      }
      console.error('❌ Error uploading file via Netlify Function:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        url: response.url,
      });
      return null;
    }

    console.log('📥 [uploadFile] Парсинг ответа...');
    const result = await response.json();
    console.log('✅ [uploadFile] Ответ получен:', {
      success: result.success,
      hasUrl: !!result.data?.url,
      hasStoragePath: !!result.data?.storagePath,
      hasError: !!result.error,
      category,
    });

    if (!result.success || !result.data?.url) {
      console.error('❌ [uploadFile] Upload failed:', result.error || 'Unknown error');
      return null;
    }

    // Для категории articles возвращаем storagePath, чтобы клиент мог правильно извлечь имя файла
    // Для остальных категорий возвращаем публичный URL
    let finalUrl = result.data.url;

    if (category === 'articles' && result.data.storagePath) {
      // Для articles возвращаем storagePath вместо publicUrl
      // Клиент будет использовать его для извлечения имени файла
      finalUrl = result.data.storagePath;
      console.log('📝 [uploadFile] Для articles возвращаем storagePath:', {
        storagePath: finalUrl,
        originalUrl: result.data.url,
      });
    }

    // Для hero изображений result.data.url может содержать storagePath или уже готовый URL
    // Если это storagePath (начинается с "users/.../hero/"), формируем proxy URL
    if (category === 'hero') {
      if (finalUrl.startsWith('users/') && finalUrl.includes('/hero/')) {
        // Извлекаем fileName из storagePath
        const pathParts = finalUrl.split('/');
        const fileName = pathParts[pathParts.length - 1];

        // Формируем proxy URL
        const origin =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NETLIFY_SITE_URL || '';
        finalUrl = `${origin}/.netlify/functions/proxy-image?path=${encodeURIComponent(finalUrl)}`;

        console.log('🔗 [uploadFile] Сформирован proxy URL для hero:', {
          storagePath: result.data.url,
          fileName,
          finalUrl,
        });
      } else if (!finalUrl.includes('proxy-image') && !finalUrl.includes('supabase.co')) {
        // Если URL не содержит proxy-image и не является Supabase URL, возможно это storagePath
        // Попробуем сформировать proxy URL
        const origin =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NETLIFY_SITE_URL || '';
        finalUrl = `${origin}/.netlify/functions/proxy-image?path=${encodeURIComponent(finalUrl)}`;

        console.log('🔗 [uploadFile] Сформирован proxy URL для hero (fallback):', {
          originalUrl: result.data.url,
          finalUrl,
        });
      }
    }

    return finalUrl;
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return null;
  }
}

/**
 * Получить список файлов/папок в произвольном префиксе хранилища (public bucket)
 * @param prefix полный путь внутри bucket, например "users/zhoock/audio" или "users/zhoock/audio/23_Mixer"
 */
export async function listStorageByPrefix(prefix: string): Promise<string[] | null> {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is not available. Please set required environment variables.');
      return null;
    }

    console.log('🔍 [listStorageByPrefix] Listing files in:', prefix);
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(prefix, { limit: 1000 });

    if (error) {
      console.error('❌ [listStorageByPrefix] Error listing storage prefix:', {
        prefix,
        error: error.message,
        errorCode: (error as any).statusCode,
        errorName: error.name,
      });
      return null;
    }

    // Фильтруем только файлы (не папки)
    // В Supabase Storage папки имеют id === null и metadata === null
    // Файлы имеют id !== null
    const files = (data || []).filter((item) => item.id !== null);
    const folders = (data || []).filter((item) => item.id === null && item.metadata === null);

    const fileNames = files.map((item) => item.name);
    console.log('✅ [listStorageByPrefix] Found files:', {
      prefix,
      filesCount: fileNames.length,
      foldersCount: folders.length,
      files: fileNames,
      folders: folders.map((f) => f.name),
      allItems:
        data?.map((item) => ({
          name: item.name,
          id: item.id,
          isFile: item.id !== null,
          isFolder: item.id === null && item.metadata === null,
          updated_at: item.updated_at,
          created_at: item.created_at,
          last_accessed_at: item.last_accessed_at,
          metadata: item.metadata,
        })) || [],
    });

    return fileNames;
  } catch (error) {
    console.error('❌ [listStorageByPrefix] Exception:', error);
    return null;
  }
}

/**
 * Сформировать прокси URL по полному пути в Storage
 * @param storagePath полный путь, например "users/zhoock/audio/23_Mixer/01_FRB_drums.mp3"
 */
export function buildProxyUrlFromPath(storagePath: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : process.env.NETLIFY_SITE_URL || '';
  return `${origin}/api/proxy-image?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Загрузить файл в Supabase Storage используя service role key (обходит RLS)
 * ⚠️ ВАЖНО: Использовать ТОЛЬКО в серверных скриптах/функциях, НИКОГДА на клиенте!
 * @param options - опции загрузки
 * @returns URL загруженного файла или null в случае ошибки
 */
export async function uploadFileAdmin(options: UploadFileOptions): Promise<string | null> {
  try {
    const {
      userId = CURRENT_USER_CONFIG.userId,
      category,
      file,
      fileName,
      contentType,
      upsert = false,
    } = options;

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      console.error(
        'Supabase admin client is not available. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.'
      );
      return null;
    }

    const storagePath = getStoragePath(userId, category, fileName);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(storagePath, file, {
        contentType: contentType || (file instanceof File ? file.type : 'image/jpeg'),
        upsert,
        cacheControl: '3600', // Кеш на 1 час
      });

    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      return null;
    }

    // Получаем публичный URL файла
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadFileAdmin:', error);
    return null;
  }
}

/**
 * Получить публичный URL файла из Supabase Storage
 * @param options - опции для получения URL
 * @returns Публичный URL файла
 */
export function getStorageFileUrl(options: GetFileUrlOptions): string {
  // Получаем UUID текущего пользователя, или используем переданный userId, или fallback на UUID из конфига
  const defaultUserId = getUserUserId() || CURRENT_USER_CONFIG.userId;
  const { userId = defaultUserId, category, fileName } = options;

  // Убираем логирование для предотвращения бесконечных циклов
  // Если нужно отладить, используйте React DevTools или добавьте breakpoint
  // if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  //   console.log('[getStorageFileUrl]', {
  //     category,
  //     fileName,
  //     userId: userId.substring(0, 8) + '...',
  //     fromAuth: !!getUserUserId(),
  //   });
  // }

  const storagePath = getStoragePath(userId, category, fileName);

  // Для аудио лучше использовать прямой публичный URL, чтобы браузер корректно получал метаданные
  if (category === 'audio') {
    const supabase = createSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is not available. Please set required environment variables.');
      return '';
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  // Для изображений оставляем прокси через Netlify функцию
  const origin =
    typeof window !== 'undefined' ? window.location.origin : process.env.NETLIFY_SITE_URL || '';

  // В production используем /api/proxy-image, в localhost - /.netlify/functions/proxy-image
  const isProduction =
    typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1');
  const proxyPath = isProduction ? '/api/proxy-image' : '/.netlify/functions/proxy-image';

  return `${origin}${proxyPath}?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Получить временную (signed) URL файла из Supabase Storage
 * Используется для приватных файлов
 * @param options - опции для получения URL
 * @returns Временный URL файла или null в случае ошибки
 */
export async function getStorageSignedUrl(options: GetFileUrlOptions): Promise<string | null> {
  try {
    const defaultUserId = getUserUserId() || CURRENT_USER_CONFIG.userId;
    const { userId = defaultUserId, category, fileName, expiresIn = 3600 } = options;

    const supabase = createSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is not available. Please set required environment variables.');
      return null;
    }

    const storagePath = getStoragePath(userId, category, fileName);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error in getStorageSignedUrl:', error);
    return null;
  }
}

/**
 * Удалить файл из Supabase Storage
 * @param userId - ID пользователя
 * @param category - категория файла
 * @param fileName - имя файла
 * @returns true если успешно, false в случае ошибки
 */
export async function deleteStorageFile(
  userId: string,
  category: ImageCategory,
  fileName: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is not available. Please set required environment variables.');
      return false;
    }

    const storagePath = getStoragePath(userId, category, fileName);

    const { error } = await supabase.storage.from(STORAGE_BUCKET_NAME).remove([storagePath]);

    if (error) {
      console.error('Error deleting file from Supabase Storage:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteStorageFile:', error);
    return false;
  }
}

/**
 * Удалить hero изображение и все его варианты из Storage
 * @param imageUrl - URL изображения (может быть полный URL, image-set() строка или простой путь)
 * @returns true если успешно, false в случае ошибки
 */
export async function deleteHeroImage(imageUrl: string): Promise<boolean> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch('/api/delete-hero-image', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error deleting hero image:', errorData.error || response.statusText);
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Error in deleteHeroImage:', error);
    return false;
  }
}

/**
 * Получить список файлов в категории пользователя
 * @param userId - ID пользователя
 * @param category - категория файлов
 * @returns Массив имен файлов или null в случае ошибки
 */
export async function listStorageFiles(
  userId: string,
  category: ImageCategory
): Promise<string[] | null> {
  try {
    const supabase = createSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is not available. Please set required environment variables.');
      return null;
    }

    const folderPath = `users/${userId}/${category}`;

    const { data, error } = await supabase.storage.from(STORAGE_BUCKET_NAME).list(folderPath);

    if (error) {
      console.error('Error listing files from Supabase Storage:', error);
      return null;
    }

    return data?.map((file) => file.name) || [];
  } catch (error) {
    console.error('Error in listStorageFiles:', error);
    return null;
  }
}
