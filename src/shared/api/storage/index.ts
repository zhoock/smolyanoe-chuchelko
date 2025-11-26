/**
 * API для работы с Supabase Storage
 */

import { createSupabaseClient, STORAGE_BUCKET_NAME } from '@config/supabase';
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
 * Загрузить файл в Supabase Storage
 * @param options - опции загрузки
 * @returns URL загруженного файла или null в случае ошибки
 */
export async function uploadFile(options: UploadFileOptions): Promise<string | null> {
  try {
    const {
      userId = CURRENT_USER_CONFIG.userId,
      category,
      file,
      fileName,
      contentType,
      upsert = false,
    } = options;

    const supabase = createSupabaseClient();
    if (!supabase) {
      console.error('Supabase client is not available. Please set required environment variables.');
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
    console.error('Error in uploadFile:', error);
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

  const supabase = createSupabaseClient();
  if (!supabase) {
    console.error('Supabase client is not available. Please set required environment variables.');
    // Возвращаем пустую строку, если клиент недоступен
    return '';
  }

  const storagePath = getStoragePath(userId, category, fileName);

  const { data } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);

  return data.publicUrl;
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
