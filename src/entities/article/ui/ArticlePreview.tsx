import { Link, useSearchParams } from 'react-router-dom';
import type { ArticleProps } from '@/models';
import { useLang } from '@app/providers/lang';
import { formatDateInWords, LocaleKey } from '@entities/article/lib/formatDate';
import { withPublicArtistQuery } from '@shared/lib/artistQuery';
import { ArticleCoverImage } from './ArticleCoverImage';
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
          <ArticleCoverImage
            img={img}
            userId={userId}
            role="public"
            alt={nameArticle}
            loading="lazy"
            decoding="async"
            debugLabel={`ArticlePreview:${articleId}`}
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
