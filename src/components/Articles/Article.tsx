// src/components/Article/Article.tsx

import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import type { ArticleDetalesProps } from '../../models';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';
import { formatDateInWords } from './Function';
import { useLang } from '../../contexts/lang';

/**
 * Компонент отображает блок со статьёй.
 */
export const Article = () => {
  // скролл наверх при входе на страницу
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  const { lang } = useLang() as { lang: keyof typeof formatDateInWords };
  const data = useAlbumsData(lang); // берём промисы из роутер-лоадера

  // локализация даты
  const { formatDate } = formatDateInWords[lang];

  // параметры URL
  const { articleId = '' } = useParams<{ articleId: string }>();

  // рендер одного блока контента статьи
  function Block({ title, subtitle, strong, content, img, alt }: ArticleDetalesProps) {
    return (
      <>
        {title && <h3>{title}</h3>}
        <div className="uncollapse">{img && <img src={getImageUrl(img)} alt={alt ?? ''} />}</div>
        {subtitle && <h4>{subtitle}</h4>}

        {typeof content === 'string' ? (
          <p>
            {strong && <strong>{strong}</strong>} {content}
          </p>
        ) : (
          <ul>
            {content?.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </>
    );
  }

  // если лоадер не вернул данных (теоретически) — лёгкий скелетон
  if (!data) {
    return (
      <section className="article main-background" aria-label="Блок cо статьёй">
        <div className="wrapper">
          <h2>Статья</h2>
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section className="article main-background" aria-label="Блок cо статьёй">
      <div className="wrapper">
        {/* Хлебные крошки: заголовок "Статьи" берём из словаря */}
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ul>
            <li>
              <DataAwait value={data.templateC} fallback={<span>…</span>} error={null}>
                {(ui) => <Link to="/articles">{ui?.[0]?.titles?.articles ?? 'Статьи'}</Link>}
              </DataAwait>
            </li>
            <li className="active">
              {/* Имя статьи подтянем ниже, когда загрузятся статьи */}
              <DataAwait value={data.templateB} fallback={<span>…</span>} error={null}>
                {(articles) => articles.find((a) => a.articleId === articleId)?.nameArticle ?? '…'}
              </DataAwait>
            </li>
          </ul>
        </nav>

        {/* Сама статья: ждём список статей и ищем нужную */}
        <DataAwait
          value={data.templateB}
          fallback={<Loader />}
          error={<ErrorMessage error="Не удалось загрузить статью" />}
        >
          {(articles) => {
            const article = articles.find((a) => a.articleId === articleId);
            if (!article) {
              return <ErrorMessage error="Статья не найдена" />;
            }

            return (
              <>
                <time dateTime={article.date}>
                  <small>{formatDate(article.date)} г.</small>
                </time>
                <h2>{article.nameArticle}</h2>

                {article.detales.map((d) => (
                  <Block key={d.id} {...d} />
                ))}
              </>
            );
          }}
        </DataAwait>
      </div>
    </section>
  );
};
