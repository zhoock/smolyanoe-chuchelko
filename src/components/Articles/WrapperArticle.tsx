import React from 'react';
import { Link } from 'react-router-dom';
import { ArticleProps } from '../../models';
import { getImageUrl, alphabeticFormatDate } from '../../hooks/data';

/**
 * Компонент отображает блок с карточкой статьи.
 */
export default function WrapperArticle({
  articleId,
  img,
  nameArticle,
  date,
}: ArticleProps) {
  return (
    <article className="articles__list-item">
      <Link to={`/articles/${articleId}`}>
        <div
          className="articles__picture"
          style={{
            background: `no-repeat center/cover url(${getImageUrl(img)})`,
          }}
        ></div>
        <div className="articles__description">
          {nameArticle}
          <div className="albums__description-year">
            <time dateTime={date}>
              <small>{alphabeticFormatDate(date)}</small>
            </time>
          </div>
        </div>
      </Link>
    </article>
  );
}