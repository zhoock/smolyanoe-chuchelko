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
// Всегда используем Supabase Storage для медиа (обложки/аудио)
function shouldUseSupabaseStorage(_options?: ImageUrlOptions): boolean {
  return true;
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
 * // 'https://[project].supabase.co/storage/v1/object/public/user-media/users/zhoock/albums/album_cover.jpg'
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
  // Если это уже полный URL (http:// или https://), возвращаем как есть
  if (audioPath.startsWith('http://') || audioPath.startsWith('https://')) {
    return audioPath;
  }

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

/**
 * Форматирует дату для отображения в формате DD/MM/YYYY
 * Поддерживает ISO формат (YYYY-MM-DD) и другие форматы дат
 */
export function formatDate(dateRelease: string): string {
  if (!dateRelease || !dateRelease.trim()) {
    return '';
  }

  let date: Date;

  // Если дата уже в формате YYYY-MM-DD (ISO), парсим явно
  if (/^\d{4}-\d{2}-\d{2}/.test(dateRelease.trim())) {
    const parts = dateRelease.trim().split(/[-T]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // месяцы в JS начинаются с 0
      const day = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else {
      date = new Date(dateRelease);
    }
  } else {
    // Пытаемся распарсить через Date
    date = new Date(dateRelease);
  }

  // Проверяем валидность даты
  if (isNaN(date.getTime())) {
    return dateRelease; // Возвращаем как есть, если не удалось распарсить
  }

  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
