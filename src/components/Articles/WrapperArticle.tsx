import React from 'react';
import { Link } from 'react-router-dom';
import { ArticleProps } from '../../models';
import { getImageUrl } from '../../hooks/data';
import { formatDateInWords } from './Function'; // Импортируем функции
import { useLang } from '../../hooks/useLang';

/**
 * Компонент отображает блок с карточкой статьи.
 */
export default function WrapperArticle({ articleId, img, nameArticle, date }: ArticleProps) {
  const { lang } = useLang() as { lang: keyof typeof formatDateInWords };
  // Подгружаем функции для выбранного языка
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
