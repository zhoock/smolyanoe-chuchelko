import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { useAlbumsData, getImageUrl } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import type { ArticledetailsProps } from '../../models';
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
  const data = useAlbumsData(lang);
  const { formatDate } = formatDateInWords[lang];
  const { articleId = '' } = useParams<{ articleId: string }>();

  // рендер одного блока контента статьи
  function Block({ title, subtitle, strong, content, img, alt }: ArticledetailsProps) {
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

  // фоллбек, если данных нет
  if (!data) {
    return (
      <section className="article main-background" aria-label="Блок со статьёй">
        <div className="wrapper">
          <h2>{lang === 'en' ? 'Article' : 'Статья'}</h2>
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section className="article main-background" aria-label="Блок со статьёй">
      <div className="wrapper">
        {/* хлебные крошки */}
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ul>
            <li>
              <DataAwait value={data.templateC} fallback={<span>…</span>} error={null}>
                {(ui) => (
                  <Link to="/articles">
                    {ui?.[0]?.titles?.articles ?? (lang === 'en' ? 'Articles' : 'Статьи')}
                  </Link>
                )}
              </DataAwait>
            </li>
            <li className="active">
              <DataAwait value={data.templateB} fallback={<span>…</span>} error={null}>
                {(articles) => articles.find((a) => a.articleId === articleId)?.nameArticle ?? '…'}
              </DataAwait>
            </li>
          </ul>
        </nav>

        {/* сама статья */}
        <DataAwait
          value={data.templateB}
          fallback={<Loader />}
          error={
            <ErrorMessage
              error={lang === 'en' ? 'Failed to load article' : 'Не удалось загрузить статью'}
            />
          }
        >
          {(articles) => {
            const article = articles.find((a) => a.articleId === articleId);
            if (!article) {
              return (
                <ErrorMessage error={lang === 'en' ? 'Article not found' : 'Статья не найдена'} />
              );
            }

            // SEO на основе данных статьи
            const seoTitle = article.nameArticle;
            const seoDesc = article.description;
            const canonical =
              lang === 'en'
                ? `https://smolyanoechuchelko.ru/en/articles/${article.articleId}`
                : `https://smolyanoechuchelko.ru/articles/${article.articleId}`;

            return (
              <>
                <Helmet>
                  <title>{seoTitle}</title>
                  <meta name="description" content={seoDesc} />
                  <meta property="og:title" content={seoTitle} />
                  <meta property="og:description" content={seoDesc} />
                  <meta property="og:type" content="article" />
                  <link rel="canonical" href={canonical} />
                </Helmet>

                <time dateTime={article.date}>
                  <small>
                    {formatDate(article.date)} {lang === 'en' ? '' : 'г.'}
                  </small>
                </time>
                <h2>{article.nameArticle}</h2>

                {article.details.map((d) => (
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
