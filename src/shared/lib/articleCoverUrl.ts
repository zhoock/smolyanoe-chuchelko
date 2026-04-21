import type { ImageCategory } from '@config/user';
import { getImageUrl } from '@shared/api/albums';

const ARTICLES: ImageCategory = 'articles';

/**
 * Обложки из дашборда: ключ в БД с префиксом `article_cover_`.
 * В Storage ожидаются варианты -896 / -320 (webp + jpg). Без fallback на старый одиночный файл.
 */
export function isArticleCoverStorageKey(img: string | undefined | null): boolean {
  return typeof img === 'string' && img.startsWith('article_cover_');
}

export type ArticleCoverDisplayRole = 'public' | 'admin';

export function getArticleCoverVariantUrls(
  img: string,
  userId: string | undefined,
  role: ArticleCoverDisplayRole
): { webp: string | null; jpg: string | null } {
  if (!userId) {
    return { webp: null, jpg: null };
  }

  if (!isArticleCoverStorageKey(img)) {
    return {
      webp: null,
      jpg: getImageUrl(img, '.jpg', { userId, category: ARTICLES }),
    };
  }

  const base = img.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const dash = role === 'public' ? '-896' : '-320';

  return {
    webp: getImageUrl(`${base}${dash}.webp`, '', { userId, category: ARTICLES }),
    jpg: getImageUrl(`${base}${dash}.jpg`, '', { userId, category: ARTICLES }),
  };
}
