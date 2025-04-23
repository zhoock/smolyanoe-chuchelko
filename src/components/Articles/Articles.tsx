import React from 'react';
import { useData } from '../../hooks/data';
import WrapperArticle from '../Articles/WrapperArticle';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';
import './style.scss';

/**
 * Компонент отображает блок cо списком статей.
 */
export default function Articles() {
  const { templateData, loading, error } = useData();

  /* Элемент показывается только при загрузке данных с сервера */
  {
    loading && <Loader />;
  }

  /* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */
  {
    error && <ErrorMessage error={error} />;
  }

  return (
    <section
      className="articles main-background"
      aria-label="Блок c ссылками на статьи Смоляное чучелко"
    >
      <div className="wrapper articles__wrapper">
        <h2>{templateData.templateC[0]?.titles.articles}</h2>

        <div className="articles__list">
          {templateData.templateB.map((_) => (
            <WrapperArticle key={_.articleId} {..._} />
          ))}
        </div>
      </div>
    </section>
  );
}
