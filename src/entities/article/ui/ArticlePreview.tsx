import { Link, useSearchParams } from 'react-router-dom';
import type { ArticleProps } from '@/models';
import { getImageUrl } from '@shared/api/albums';
import { optionalMediaSrc } from '@shared/lib/media/optionalMediaUrl';
import { useLang } from '@app/providers/lang';
import { formatDateInWords, LocaleKey } from '@entities/article/lib/formatDate';
import { withPublicArtistQuery } from '@shared/lib/artistQuery';
import './style.scss';

export function ArticlePreview({ articleId, img, nameArticle, date, userId }: ArticleProps) {
  const { lang } = useLang() as { lang: LocaleKey };
  const { formatDate } = formatDateInWords[lang];
  const [searchParams] = useSearchParams();
  const articlePath = withPublicArtistQuery(`/articles/${articleId}`, searchParams.get('artist'));

  return (
    <article className="articles__card">
      <Link to={articlePath}>
        <div className="articles__picture">
          <img
            src={optionalMediaSrc(
              getImageUrl(img, '.jpg', userId ? { userId, category: 'articles' } : undefined),
              'ArticlePreview',
              { articleId, hasUserId: !!userId }
            )}
            alt={nameArticle}
            loading="lazy"
            decoding="async"
          />
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
