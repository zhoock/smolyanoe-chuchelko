import { Link } from 'react-router-dom';
import type { ArticleProps } from '@/models';
import { getImageUrl, shouldUseSupabaseStorage } from '@shared/api/albums';
import { useLang } from '@app/providers/lang';
import { formatDateInWords, LocaleKey } from '@entities/article/lib/formatDate';
import './style.scss';

export function ArticlePreview({ articleId, userId, img, nameArticle, date }: ArticleProps) {
  const { lang } = useLang() as { lang: LocaleKey };
  const { formatDate } = formatDateInWords[lang];

  // Используем userId из статьи для загрузки изображения
  const imageUrl = userId
    ? getImageUrl(img, '.jpg', {
        userId,
        category: 'articles',
        useSupabaseStorage: shouldUseSupabaseStorage(),
      })
    : getImageUrl(img, '.jpg'); // Fallback для обратной совместимости

  return (
    <article className="articles__card">
      <Link to={`/articles/${articleId}`}>
        <div className="articles__picture">
          <img src={imageUrl} alt={nameArticle} loading="lazy" decoding="async" />
        </div>
        <div className="articles__description">
          {nameArticle}

          <time dateTime={date}>
            <small>{formatDate(date)}</small>
          </time>
        </div>
      </Link>
    </article>
  );
}

export default ArticlePreview;
