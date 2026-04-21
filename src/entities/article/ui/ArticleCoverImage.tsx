import { getImageUrl } from '@shared/api/albums';
import { optionalMediaSrc } from '@shared/lib/media/optionalMediaUrl';
import {
  getArticleCoverVariantUrls,
  isArticleCoverStorageKey,
  type ArticleCoverDisplayRole,
} from '@shared/lib/articleCoverUrl';

type ArticleCoverImageProps = {
  img: string;
  userId: string | undefined;
  role: ArticleCoverDisplayRole;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'auto' | 'sync';
  debugLabel?: string;
};

/**
 * Обложка статьи: -896 для сайта, -320 для админки (webp + jpg).
 * Ключи `article_cover_*` без fallback на старый одиночный файл — битая картинка, если варианты не залиты.
 */
export function ArticleCoverImage({
  img,
  userId,
  role,
  alt,
  className,
  loading = 'lazy',
  decoding = 'async',
  debugLabel = 'ArticleCoverImage',
}: ArticleCoverImageProps) {
  const { webp, jpg } = getArticleCoverVariantUrls(img, userId, role);

  if (!userId || !isArticleCoverStorageKey(img)) {
    return (
      <img
        src={optionalMediaSrc(
          jpg ?? getImageUrl(img, '.jpg', userId ? { userId, category: 'articles' } : undefined),
          debugLabel,
          { hasUserId: !!userId }
        )}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
      />
    );
  }

  const webpSrc = webp ? optionalMediaSrc(webp, `${debugLabel}:webp`, { hasUserId: true }) : null;
  const jpgSrc = jpg ? optionalMediaSrc(jpg, `${debugLabel}:jpg`, { hasUserId: true }) : null;

  return (
    <picture>
      {webpSrc ? <source srcSet={webpSrc} type="image/webp" /> : null}
      <img
        src={jpgSrc ?? ''}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
      />
    </picture>
  );
}
