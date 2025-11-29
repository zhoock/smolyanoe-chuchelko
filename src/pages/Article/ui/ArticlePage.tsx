import { Fragment, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { getUserImageUrl } from '@shared/api/albums';
import type { ArticledetailsProps } from '@models';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { ImageCarousel } from '@shared/ui/image-carousel';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { formatDateInWords, type LocaleKey } from '@entities/article/lib/formatDate';
import {
  selectArticleById,
  selectArticlesError,
  selectArticlesStatus,
  type RequestStatus,
} from '@entities/article';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import '@entities/article/ui/style.scss';

export function ArticlePage() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const { lang } = useLang();
  const locale = useMemo(() => lang as LocaleKey, [lang]);
  const { articleId = '' } = useParams<{ articleId: string }>();
  const articlesStatus = useAppSelector((state) => selectArticlesStatus(state, lang));
  const articlesError = useAppSelector((state) => selectArticlesError(state, lang));
  const article = useAppSelector((state) => selectArticleById(state, lang, articleId));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const { formatDate } = formatDateInWords[locale];

  // Определяем, пришли ли мы со страницы списка статей
  const cameFromArticlesPage = useMemo(() => {
    if (typeof window === 'undefined') return false;

    // Проверяем sessionStorage для предыдущего пути (работает при клиентской навигации)
    const previousPath = sessionStorage.getItem('previousPath');
    if (previousPath) {
      // Проверяем, что предыдущий путь - это страница списка статей
      return previousPath === '/articles' || previousPath === '/en/articles';
    }

    // Fallback: проверяем document.referrer (работает при полной перезагрузке страницы)
    const referrer = document.referrer;
    if (!referrer) return false;

    try {
      const origin = window.location.origin;
      const referrerUrl = new URL(referrer);

      if (referrerUrl.origin !== origin) return false;

      const pathname = referrerUrl.pathname;
      return pathname === '/articles' || pathname === '/en/articles';
    } catch {
      return false;
    }
  }, []);

  function Block({ title, subtitle, strong, content, img, alt }: ArticledetailsProps) {
    return (
      <>
        {title && <h3>{title}</h3>}
        {img && (
          <div className="uncollapse">
            {Array.isArray(img) ? (
              <ImageCarousel images={img} alt={alt ?? ''} category="articles" />
            ) : (
              <img
                src={getUserImageUrl(img, 'articles')}
                alt={alt ?? ''}
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
        )}
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

  // Данные загружаются через loader

  return (
    <section className="article main-background" aria-label="Блок со статьёй">
      <div className="wrapper">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <ul>
            {ui?.links?.home && (
              <li>
                <Link to="/">{ui.links.home}</Link>
              </li>
            )}
            {/* Показываем "Все статьи" только если пришли со страницы списка */}
            {cameFromArticlesPage && ui?.titles?.articles && (
              <li>
                <Link to="/articles">{ui.titles.articles}</Link>
              </li>
            )}
          </ul>
        </nav>

        <ArticleContent
          status={articlesStatus}
          error={articlesError}
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
