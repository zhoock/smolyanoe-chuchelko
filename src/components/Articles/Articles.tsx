// src/components/Articles/Articles.tsx

import React from 'react';
import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import WrapperArticle from '../Articles/WrapperArticle';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';
import { useLang } from '../../contexts/lang';
import './style.scss';

/**
 * Компонент отображает блок cо списком статей.
 */
export const Articles = () => {
  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из роутер-лоадера

  // Теоретический фоллбек — если лоадер вернул null
  if (!data) {
    return (
      <section
        className="articles main-background"
        aria-label="Блок c ссылками на статьи Смоляное чучелко"
      >
        <div className="wrapper articles__wrapper">
          <h2>Статьи</h2>
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section
      className="articles main-background"
      aria-label="Блок c ссылками на статьи Смоляное чучелко"
    >
      <div className="wrapper articles__wrapper">
        <h2>
          <DataAwait value={data.templateC} fallback={<span>…</span>} error={null}>
            {(ui) => ui?.[0]?.titles?.articles ?? 'Статьи'}
          </DataAwait>
        </h2>

        <DataAwait
          value={data.templateB}
          fallback={<Loader />}
          error={<ErrorMessage error="Не удалось загрузить статьи" />}
        >
          {(articles) => (
            <div className="articles__list">
              {articles.map((a) => (
                <WrapperArticle key={a.articleId} {...a} />
              ))}
            </div>
          )}
        </DataAwait>
      </div>
    </section>
  );
};
