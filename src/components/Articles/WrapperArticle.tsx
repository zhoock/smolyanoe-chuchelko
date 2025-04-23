import React from 'react';
import { Link } from 'react-router-dom';
import { ArticleProps } from '../../models';
import { getImageUrl } from '../../hooks/data';
import { formatDateInWords } from './Function'; // Импортируем функции

/**
 * Компонент отображает блок с карточкой статьи.
 */
export default function WrapperArticle({
  articleId,
  img,
  nameArticle,
  date,
}: ArticleProps) {
  // Подгружаем функции для выбранного языка
  const { formatDate } = formatDateInWords.en;

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
