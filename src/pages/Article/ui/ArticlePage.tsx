import { Fragment, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { useAlbumsData, getImageUrl } from '@shared/api/albums';
import { DataAwait } from '@shared/DataAwait';
import type { ArticledetailsProps } from '@models';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { formatDateInWords, type LocaleKey } from '@entities/article/lib/formatDate';
import {
  fetchArticles,
  selectArticleById,
  selectArticlesError,
  selectArticlesStatus,
  type RequestStatus,
} from '@entities/article';
import '@entities/article/ui/style.scss';

export function ArticlePage() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const locale = useMemo(() => lang as LocaleKey, [lang]);
  const data = useAlbumsData(lang);
  const { articleId = '' } = useParams<{ articleId: string }>();
  const status = useAppSelector((state) => selectArticlesStatus(state, lang));
  const error = useAppSelector((state) => selectArticlesError(state, lang));
  const article = useAppSelector((state) => selectArticleById(state, lang, articleId));
  const { formatDate } = formatDateInWords[locale];

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

  useEffect(() => {
    if (!articleId) {
      return;
    }

    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchArticles({ lang }));
      return () => {
        promise.abort();
      };
    }

    return;
  }, [dispatch, lang, status, articleId]);

  if (!data) {
    return (
      <section className="article main-background" aria-label="Блок со статьёй">
        <div className="wrapper">
          <h2>{locale === 'en' ? 'Article' : 'Статья'}</h2>
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

        <ArticleContent
          status={status}
          error={error}
          article={article}
          formatDate={formatDate}
          lang={locale}
          renderBlock={Block}
        />
      </div>
    </section>
  );
}

type ArticleContentProps = {
  status: RequestStatus;
  error: string | null;
  article: ReturnType<typeof selectArticleById>;
  formatDate: (value: string) => string;
  lang: LocaleKey;
  renderBlock: (details: ArticledetailsProps) => JSX.Element;
};

function ArticleContent({
  status,
  error,
  article,
  formatDate,
  lang,
  renderBlock,
}: ArticleContentProps) {
  if (!article) {
    if (status === 'loading' || status === 'idle') {
      return <Loader />;
    }

    if (status === 'failed') {
      return (
        <ErrorMessage
          error={
            error ?? (lang === 'en' ? 'Failed to load article' : 'Не удалось загрузить статью')
          }
        />
      );
    }

    return <ErrorMessage error={lang === 'en' ? 'Article not found' : 'Статья не найдена'} />;
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
        <Fragment key={d.id}>{renderBlock(d)}</Fragment>
      ))}
    </>
  );
}

export default ArticlePage;
