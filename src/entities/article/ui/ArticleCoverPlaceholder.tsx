import clsx from 'clsx';
import {
  ARTICLE_COVER_PLACEHOLDER_DARK_SRC,
  ARTICLE_COVER_PLACEHOLDER_LIGHT_SRC,
} from '@shared/lib/articlePlaceholder';

import './ArticleCoverPlaceholder.scss';

type ArticleCoverPlaceholderProps = {
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'auto' | 'sync';
};

/**
 * Плейсхолдер обложки статьи: светлый и тёмный варианты через `html.theme-light` / `html.theme-dark`.
 */
export function ArticleCoverPlaceholder({
  alt,
  className,
  loading = 'lazy',
  decoding = 'async',
}: ArticleCoverPlaceholderProps) {
  return (
    <span className={clsx('article-cover-placeholder', className)}>
      <img
        className="article-cover-placeholder__img article-cover-placeholder__img--light"
        src={ARTICLE_COVER_PLACEHOLDER_LIGHT_SRC}
        alt={alt}
        loading={loading}
        decoding={decoding}
      />
      <img
        className="article-cover-placeholder__img article-cover-placeholder__img--dark"
        src={ARTICLE_COVER_PLACEHOLDER_DARK_SRC}
        alt=""
        aria-hidden
        loading={loading}
        decoding={decoding}
      />
    </span>
  );
}
