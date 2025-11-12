import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { useAlbumsData, getImageUrl } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import type { ArticledetailsProps } from '@models';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { useLang } from '@contexts/lang';
import { formatDateInWords, LocaleKey } from '@entities/article/lib/formatDate';
import '@entities/article/ui/style.scss';

export function ArticlePage() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const { lang } = useLang() as { lang: LocaleKey };
  const data = useAlbumsData(lang);
  const { formatDate } = formatDateInWords[lang];
  const { articleId = '' } = useParams<{ articleId: string }>();

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
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ul>
            <li>
              <DataAwait value={data.templateC} fallback={null} error={null}>
                {(ui) => {
                  const homeLabel = ui?.[0]?.links?.home;
                  return homeLabel ? <Link to="/">{homeLabel}</Link> : null;
                }}
              </DataAwait>
            </li>
          </ul>
        </nav>

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
}

export default ArticlePage;
