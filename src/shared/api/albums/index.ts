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

/**
 * Получить URL аудио файла
 * @param audioPath - путь к аудио файлу относительно src/audio (например, "23/01-Barnums-Fijian-Mermaid-1644.wav" или "EP_Mixer/01_PPB_drums.mp3")
 *                   или полный путь вида "/audio/23/01-Barnums-Fijian-Mermaid-1644.wav" (будет автоматически обработан)
 * @param useSupabaseStorage - использовать Supabase Storage (опционально, по умолчанию из переменной окружения)
 * @returns URL аудио файла
 *
 * @example
 * getUserAudioUrl('23/01-Barnums-Fijian-Mermaid-1644.wav') // '/audio/23/01-Barnums-Fijian-Mermaid-1644.wav'
 * getUserAudioUrl('/audio/23/01-Barnums-Fijian-Mermaid-1644.wav') // '/audio/23/01-Barnums-Fijian-Mermaid-1644.wav' или Supabase Storage URL
 * getUserAudioUrl('EP_Mixer/01_PPB_drums.mp3', true) // Supabase Storage URL
 */
export function getUserAudioUrl(audioPath: string, useSupabaseStorage?: boolean): string {
  // Убираем префикс /audio/ если он есть
  const normalizedPath = audioPath.startsWith('/audio/') ? audioPath.slice(7) : audioPath;

  // Проверяем, нужно ли использовать Supabase Storage
  const shouldUseStorage =
    useSupabaseStorage !== undefined
      ? useSupabaseStorage
      : typeof window !== 'undefined'
        ? import.meta.env.VITE_USE_SUPABASE_STORAGE === 'true'
        : process.env.USE_SUPABASE_STORAGE === 'true';

  if (shouldUseStorage) {
    // Используем Supabase Storage
    // normalizedPath может быть с подпапками, например "23/01-Barnums-Fijian-Mermaid-1644.wav"
    return getStorageFileUrl({
      userId: CURRENT_USER_CONFIG.userId,
      category: 'audio',
      fileName: normalizedPath,
    });
  }

  // Локальные файлы
  return `/audio/${normalizedPath}`;
}

export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
