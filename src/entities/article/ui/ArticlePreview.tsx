import { Link } from 'react-router-dom';
import type { ArticleProps } from '@/models';
import { getImageUrl } from '@hooks/data';
import { useLang } from '@contexts/lang';
import { formatDateInWords, LocaleKey } from '@entities/article/lib/formatDate';
import './style.scss';

export function ArticlePreview({ articleId, img, nameArticle, date }: ArticleProps) {
  const { lang } = useLang() as { lang: LocaleKey };
  const { formatDate } = formatDateInWords[lang];

  return (
    <article className="articles__card">
      <Link to={`/articles/${articleId}`}>
        <div
          className="articles__picture"
          style={{
            background: `no-repeat center/cover url(${getImageUrl(img)})`,
          }}
        ></div>
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
