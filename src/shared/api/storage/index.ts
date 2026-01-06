/**
 * API для работы с Supabase Storage
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
  // Для категории 'hero' используем 'zhoock' вместо UUID для совместимости с существующими путями
  const targetUserId = category === 'hero' ? 'zhoock' : userId;
  return `users/${targetUserId}/${category}/${fileName}`;
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
    const { userId = CURRENT_USER_CONFIG.userId, category, file, fileName, contentType } = options;

    // Достаём токен (динамический импорт, чтобы избежать циклических зависимостей)
    const { getToken } = await import('@shared/lib/auth');
    const token = getToken();
    if (!token) {
      console.error('User is not authenticated. Please log in to upload files.');
      return null;
    }

    const fileBase64 = await fileToBase64(file);

    const response = await fetch('/api/upload-file', {
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
        originalFileSize: file.size,
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
      console.error('❌ Error uploading file via Netlify Function:', {
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

    let finalUrl = result.data.url;

    // Для hero изображений result.data.url может содержать storagePath или уже готовый URL
    // Если это storagePath (начинается с "users/zhoock/hero/"), формируем proxy URL
    if (category === 'hero') {
      if (
        finalUrl.startsWith('users/zhoock/hero/') ||
        (finalUrl.startsWith('users/') && finalUrl.includes('/hero/'))
      ) {
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
  const { userId = CURRENT_USER_CONFIG.userId, category, fileName } = options;
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
  return `${origin}/.netlify/functions/proxy-image?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Получить временную (signed) URL файла из Supabase Storage
 * Используется для приватных файлов
 * @param options - опции для получения URL
 * @returns Временный URL файла или null в случае ошибки
 */
export async function getStorageSignedUrl(options: GetFileUrlOptions): Promise<string | null> {
  try {
    const { userId = CURRENT_USER_CONFIG.userId, category, fileName, expiresIn = 3600 } = options;

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
