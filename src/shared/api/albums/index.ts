import { CURRENT_USER_CONFIG, type ImageCategory } from '@config/user';
import { getStorageFileUrl } from '@shared/api/storage';

export interface ImageUrlOptions {
  userId?: string;
  category?: ImageCategory;
  useCDN?: boolean;
  useSupabaseStorage?: boolean; // Использовать Supabase Storage вместо локальных файлов
}

/**
 * Проверяет, включено ли использование Supabase Storage
 */
function shouldUseSupabaseStorage(options?: ImageUrlOptions): boolean {
  // Если явно указано в опциях
  if (options?.useSupabaseStorage !== undefined) {
    return options.useSupabaseStorage;
  }

  // Проверяем переменную окружения
  if (typeof window !== 'undefined') {
    return import.meta.env.VITE_USE_SUPABASE_STORAGE === 'true';
  }

  return process.env.USE_SUPABASE_STORAGE === 'true';
}

/**
 * Получить URL изображения
 * @param img - имя файла изображения (без расширения)
 * @param format - расширение файла (по умолчанию '.jpg')
 * @param options - опции для пользовательских изображений
 * @returns URL изображения
 *
 * @example
 * // Старый способ (обратная совместимость)
 * getImageUrl('album_cover') // '/images/album_cover.jpg'
 *
 * // Новый способ с категорией (локальные файлы)
 * getImageUrl('album_cover', '.jpg', { userId: 'zhoock', category: 'albums' })
 * // '/images/users/zhoock/albums/album_cover.jpg'
 *
 * // Новый способ с Supabase Storage
 * getImageUrl('album_cover', '.jpg', { userId: 'zhoock', category: 'albums', useSupabaseStorage: true })
 * // 'https://[project].supabase.co/storage/v1/object/public/user-images/users/zhoock/albums/album_cover.jpg'
 */
export function getImageUrl(
  img: string,
  format: string = '.jpg',
  options?: ImageUrlOptions
): string {
  const { userId, category } = options || {};

  // Если указан userId и category
  if (userId && category) {
    const fileName = `${img}${format}`;

    // Используем Supabase Storage, если включено
    if (shouldUseSupabaseStorage(options)) {
      return getStorageFileUrl({ userId, category, fileName });
    }

    // Локальные файлы
    return `/images/users/${userId}/${category}/${fileName}`;
  }

  // Старый формат для обратной совместимости
  return `/images/${img}${format}`;
}

/**
 * Получить URL изображения для текущего пользователя
 * @param img - имя файла изображения (без расширения)
 * @param category - категория изображения
 * @param format - расширение файла (по умолчанию '.jpg')
 * @param useSupabaseStorage - использовать Supabase Storage (опционально)
 * @returns URL изображения
 *
 * @example
 * getUserImageUrl('album_cover', 'albums') // '/images/users/zhoock/albums/album_cover.jpg'
 * getUserImageUrl('album_cover', 'albums', '.jpg', true) // Supabase Storage URL
 */
export function getUserImageUrl(
  img: string,
  category: ImageCategory,
  format: string = '.jpg',
  useSupabaseStorage?: boolean
): string {
  // В будущем userId можно брать из контекста/Redux
  return getImageUrl(img, format, {
    userId: CURRENT_USER_CONFIG.userId,
    category,
    useSupabaseStorage,
  });
}

export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
