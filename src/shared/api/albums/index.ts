import { CURRENT_USER_CONFIG, type ImageCategory } from '@config/user';

export interface ImageUrlOptions {
  userId?: string;
  category?: ImageCategory;
  useCDN?: boolean;
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
 * // Новый способ с категорией
 * getImageUrl('album_cover', '.jpg', { userId: 'zhoock', category: 'albums' })
 * // '/images/users/zhoock/albums/album_cover.jpg'
 */
export function getImageUrl(
  img: string,
  format: string = '.jpg',
  options?: ImageUrlOptions
): string {
  const { userId, category } = options || {};

  // Если указан userId и category - используем новую структуру
  if (userId && category) {
    return `/images/users/${userId}/${category}/${img}${format}`;
  }

  // Старый формат для обратной совместимости
  return `/images/${img}${format}`;
}

/**
 * Получить URL изображения для текущего пользователя
 * @param img - имя файла изображения (без расширения)
 * @param category - категория изображения
 * @param format - расширение файла (по умолчанию '.jpg')
 * @returns URL изображения
 *
 * @example
 * getUserImageUrl('album_cover', 'albums') // '/images/users/zhoock/albums/album_cover.jpg'
 */
export function getUserImageUrl(
  img: string,
  category: ImageCategory,
  format: string = '.jpg'
): string {
  // В будущем userId можно брать из контекста/Redux
  return getImageUrl(img, format, { userId: CURRENT_USER_CONFIG.userId, category });
}

export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
