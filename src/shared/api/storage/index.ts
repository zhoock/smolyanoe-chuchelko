/**
 * API для работы с Supabase Storage
 *
 * ВАЖНО: Для обхода блокировок российских операторов:
 * - getStorageFileUrl и getStorageSignedUrl используют прокси через Netlify Functions
 * - uploadFile, deleteStorageFile, listStorageFiles все еще делают прямые запросы к Supabase
 *   (можно переделать на Netlify Functions при необходимости)
 */

import {
  createSupabaseClient,
  createSupabaseAdminClient,
  STORAGE_BUCKET_NAME,
} from '@config/supabase';
import { CURRENT_USER_CONFIG, type ImageCategory } from '@config/user';

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
  return `users/${userId}/${category}/${fileName}`;
}

/**
 * Конвертирует File/Blob в base64 строку
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Убираем префикс "data:image/jpeg;base64," если есть
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Загрузить файл в Supabase Storage через Netlify Function
 * Использует service role key на сервере, обходит RLS политики
 * @param options - опции загрузки
 * @returns URL загруженного файла или null в случае ошибки
 */
export async function uploadFile(options: UploadFileOptions): Promise<string | null> {
  try {
    const { userId = CURRENT_USER_CONFIG.userId, category, file, fileName, contentType } = options;

    // Импортируем функции аутентификации динамически, чтобы избежать циклических зависимостей
    const { getToken } = await import('@shared/lib/auth');
    const token = getToken();

    if (!token) {
      console.error('User is not authenticated. Please log in to upload files.');
      return null;
    }

    // Логируем информацию о файле перед конвертацией
    console.log('📤 Preparing file for upload:', {
      fileName,
      originalFileName: file instanceof File ? file.name : 'Blob',
      fileSize: file.size,
      fileType: file instanceof File ? file.type : 'unknown',
      lastModified: file instanceof File ? new Date(file.lastModified).toISOString() : 'N/A',
    });

    // Конвертируем файл в base64
    const fileBase64 = await fileToBase64(file);

    // Проверяем размер base64 (должен быть примерно на 33% больше оригинала)
    const base64Size = fileBase64.length;
    const expectedBase64Size = Math.ceil(file.size * 1.33);
    const sizeDiff = Math.abs(base64Size - expectedBase64Size);

    console.log('📦 File converted to base64:', {
      originalSize: file.size,
      base64Size,
      expectedBase64Size,
      sizeDiff,
      isValid: sizeDiff < file.size * 0.1, // Разница не должна быть больше 10%
    });

    // Отправляем запрос на Netlify Function
    const response = await fetch('/.netlify/functions/upload-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileBase64,
        fileName,
        userId,
        category,
        contentType: contentType || (file instanceof File ? file.type : 'image/jpeg'),
        originalFileSize: file.size, // Передаём размер для проверки на сервере
        originalFileName: file instanceof File ? file.name : undefined,
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        const text = await response.text().catch(() => 'Unable to read response');
        errorData = { error: `HTTP ${response.status}: ${text}` };
      }
      console.error('❌ Error uploading file:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        url: response.url,
      });
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data?.url) {
      console.error('Upload failed:', result.error || 'Unknown error');
      return null;
    }

    console.debug('uploadFile success', {
      url: result.data.url,
      storagePath: result.data.storagePath,
    });

    return result.data.url;
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return null;
  }
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
 * Использует прокси через Netlify Functions для обхода блокировок российских операторов
 * @param options - опции для получения URL
 * @returns Публичный URL файла через прокси
 */
export function getStorageFileUrl(options: GetFileUrlOptions): string {
  const { userId = CURRENT_USER_CONFIG.userId, category, fileName } = options;

  const storagePath = getStoragePath(userId, category, fileName);

  // Используем прокси через Netlify Functions вместо прямого URL Supabase
  // Это позволяет обойти блокировки российских операторов
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://smolyanoechuchelko.ru';
  const proxyUrl = `${origin}/api/proxy-image?path=${encodeURIComponent(storagePath)}`;

  return proxyUrl;
}

/**
 * Получить временную (signed) URL файла из Supabase Storage
 * Используется для приватных файлов
 * Использует прокси через Netlify Functions для обхода блокировок российских операторов
 * @param options - опции для получения URL
 * @returns Временный URL файла через прокси или null в случае ошибки
 */
export async function getStorageSignedUrl(options: GetFileUrlOptions): Promise<string | null> {
  try {
    const { userId = CURRENT_USER_CONFIG.userId, category, fileName } = options;

    // Для приватных файлов также используем прокси
    // Прокси будет делать запрос с service role key на сервере
    const storagePath = getStoragePath(userId, category, fileName);

    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://smolyanoechuchelko.ru';
    const proxyUrl = `${origin}/api/proxy-image?path=${encodeURIComponent(storagePath)}`;

    return proxyUrl;
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
