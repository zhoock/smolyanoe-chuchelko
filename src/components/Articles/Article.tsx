import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useData, getImageUrl } from '../../hooks/data';
import { ArticleDetalesProps } from '../../models';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';
import { formatDateInWords } from './Function'; // Импортируем функции
import { useLang } from '../../hooks/useLang';

/**
 * Компонент отображает блок со статьёй.
 */
export default function Article() {
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    });
  }, []);
  // Подгружаем функции для выбранного языка
  const { formatDate } = formatDateInWords.en;
  const { lang } = useLang();
  const { templateData, loading, error } = useData(lang);

  const params = useParams<{ articleId: string }>(); // возвращает все параметры, доступные на этой странице

  const article = templateData.templateB.find(
    (_) => _.articleId === params.articleId,
  );

  function Block({
    title,
    subtitle,
    strong,
    content,
    img,
    alt,
  }: ArticleDetalesProps) {
    return (
      <>
        {title && <h3>{title}</h3>}
        <div className="uncollapse">
          {img && <img src={getImageUrl(img)} alt={alt} />}
        </div>
        {subtitle && <h4>{subtitle}</h4>}
        {typeof content == 'string' ? (
          <p>
            {strong && <strong>{strong}</strong>} {content && content}
          </p>
        ) : (
          <ul>{content?.map((item, i) => <li key={i}>{item}</li>)}</ul>
        )}
      </>
    );
  }

  return (
    <section className="article main-background" aria-label="Блок cо статьёй">
      <div className="wrapper">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ul>
            <li>
              <Link to="/articles">
                {templateData.templateC[0]?.titles.articles}
              </Link>
            </li>
            <li className="active">{article?.nameArticle}</li>
          </ul>
        </nav>

        {/* Элемент показывается только при загрузке данных с сервера */}
        {loading && <Loader />}
        {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
        {error && <ErrorMessage error={error} />}

        {article && (
          <>
            <time dateTime={article.date}>
              <small>{formatDate(article.date)} г.</small>
            </time>
            <h2>{article.nameArticle}</h2>

            {article.detales.map((_) => (
              <Block key={_.id} {..._} />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
