import { Fragment, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { getImageUrl } from '@shared/api/albums';
import { optionalMediaSrc } from '@shared/lib/media/optionalMediaUrl';
import type { ArticledetailsProps } from '@models';
import { ArticleSkeleton } from './ArticleSkeleton';
import { ErrorMessage } from '@shared/ui/error-message';
import { ImageCarousel } from '@shared/ui/image-carousel';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { formatDateInWords, type LocaleKey } from '@entities/article/lib/formatDate';
import {
  selectArticleByIdResolved,
  selectArticlesError,
  selectArticlesStatus,
  type RequestStatus,
} from '@entities/article';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { withPublicArtistQuery } from '@shared/lib/artistQuery';
import { SubscriberContentLockIcon } from '@shared/ui/icons/SubscriberContentLockIcon';
import { ArticleCoverImage } from '@entities/article/ui/ArticleCoverImage';
import { useArchiveAccessModal } from '@shared/lib/archiveAccessModal';
import { refreshPremiumContentForArchiveChange } from '@features/artistArchive';
import '@entities/article/ui/style.scss';

export function ArticlePage() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const { lang } = useLang();
  const locale = useMemo(() => lang as LocaleKey, [lang]);
  const { articleId = '' } = useParams<{ articleId: string }>();
  const [searchParams] = useSearchParams();
  const artistSlug = searchParams.get('artist');

  useEffect(() => {
    const onArchiveChanged = () => {
      refreshPremiumContentForArchiveChange(dispatch, artistSlug);
    };
    window.addEventListener('archive:changed', onArchiveChanged);
    return () => window.removeEventListener('archive:changed', onArchiveChanged);
  }, [artistSlug, dispatch]);
  const homePath = withPublicArtistQuery('/', artistSlug);
  const articlesListPath = withPublicArtistQuery('/articles', artistSlug);
  const articlesStatus = useAppSelector((state) => selectArticlesStatus(state));
  const articlesError = useAppSelector((state) => selectArticlesError(state));
  const article = useAppSelector((state) => selectArticleByIdResolved(state, articleId));
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

  function Block({
    title,
    subtitle,
    strong,
    content,
    img,
    alt,
    images,
    type,
    userId,
  }: ArticledetailsProps) {
    // Определяем, есть ли карусель: проверяем images или img как массив
    const carouselImages =
      images && Array.isArray(images) ? images : Array.isArray(img) ? img : null;
    const singleImage = !carouselImages && img && typeof img === 'string' ? img : null;

    return (
      <>
        {title && <h3>{title}</h3>}
        {carouselImages && carouselImages.length > 0 && (
          <div className="uncollapse">
            {/* #region agent log */}
            {(() => {
              return null;
            })()}
            {/* #endregion */}
            <ImageCarousel
              images={carouselImages}
              alt={alt ?? ''}
              category="articles"
              userId={userId}
            />
          </div>
        )}
        {singleImage && (
          <div className="uncollapse">
            <img
              src={optionalMediaSrc(
                getImageUrl(
                  singleImage,
                  '.jpg',
                  userId ? { userId, category: 'articles' } : undefined
                ),
                'ArticlePage:singleImage',
                { hasUserId: !!userId }
              )}
              alt={alt ?? ''}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        {subtitle && <h4>{subtitle}</h4>}

        {/* Разделитель */}
        {typeof content === 'string' && content === '---' ? (
          <hr />
        ) : typeof content === 'string' ? (
          <p>
            {strong && <strong>{strong}</strong>} {content}
          </p>
        ) : (
          <ul>
            {content?.map((item, i) => {
              const text = typeof item === 'string' ? item : item.text;
              const key = typeof item === 'string' ? i : item.id;
              return <li key={key}>{text}</li>;
            })}
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
                <Link to={homePath}>{ui.links.home}</Link>
              </li>
            )}
            {/* Показываем "Все статьи" только если пришли со страницы списка */}
            {cameFromArticlesPage && ui?.titles?.articles && (
              <li>
                <Link to={articlesListPath}>{ui.titles.articles}</Link>
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
          artistSlug={artistSlug}
          renderBlock={Block}
        />
      </div>
    </section>
  );
}

type ArticleContentProps = {
  status: RequestStatus;
  error: string | null;
  article: ReturnType<typeof selectArticleByIdResolved>;
  formatDate: (value: string) => string;
  lang: LocaleKey;
  artistSlug: string | null;
  renderBlock: (details: ArticledetailsProps) => JSX.Element;
};

function ArticleContent({
  status,
  error,
  article,
  formatDate,
  lang,
  artistSlug,
  renderBlock,
}: ArticleContentProps) {
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const { open: openArchiveAccessModal } = useArchiveAccessModal();
  const openPremiumPaywall = () => {
    openArchiveAccessModal({
      artistUserId: article?.userId,
      artistSlug,
    });
  };

  const overlayTitle =
    ui?.titles?.articleLockedOverlayTitle ??
    (lang === 'en' ? 'Subscribers only' : 'Только для подписчиков');
  const overlayHint =
    ui?.titles?.articleLockedOverlayHint ??
    (lang === 'en' ? 'Purchase an album to read this content.' : 'Оформите подписку, чтобы читать');
  const ctaLabel =
    ui?.buttons?.archiveAccessSubscribe ?? (lang === 'en' ? 'Start Premium' : 'Стать Premium');
  if (!article) {
    if (status === 'loading' || status === 'idle') {
      return <ArticleSkeleton />;
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

  if (article.articleLocked) {
    const seoTitle = article.nameArticle;
    const canonical =
      lang === 'en'
        ? `https://smolyanoechuchelko.ru/en/articles/${article.articleId}`
        : `https://smolyanoechuchelko.ru/articles/${article.articleId}`;

    return (
      <>
        <Helmet>
          <title>{seoTitle}</title>
          <meta name="description" content={overlayHint} />
          <meta property="og:title" content={seoTitle} />
          <meta property="og:description" content={overlayHint} />
          <meta property="og:type" content="article" />
          <link rel="canonical" href={canonical} />
        </Helmet>

        <div className="article__locked-shell">
          <time dateTime={article.date}>
            <small>
              {formatDate(article.date)} {lang === 'en' ? '' : 'г.'}
            </small>
          </time>
          <div className="article__locked-cover-wrap">
            <div className="article__locked-cover">
              <ArticleCoverImage
                img={article.img}
                userId={article.userId}
                role="public"
                alt=""
                loading="eager"
                decoding="async"
                debugLabel={`ArticlePage:locked:${article.articleId}`}
              />
              <div className="article__locked-overlay" aria-hidden="true">
                <SubscriberContentLockIcon className="article__locked-icon" size={40} />
                <p className="article__locked-overlay-title">{overlayTitle}</p>
                <p className="article__locked-overlay-hint">{overlayHint}</p>
              </div>
            </div>
          </div>
          <h2 className="article__locked-heading">{article.nameArticle}</h2>
          <button type="button" className="article__locked-cta" onClick={openPremiumPaywall}>
            {ctaLabel}
          </button>
        </div>
      </>
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

      {article.details.map((d, index) => (
        <Fragment key={d.blockId ?? d.id ?? `detail-${index}`}>
          {renderBlock({ ...d, userId: article.userId })}
        </Fragment>
      ))}
    </>
  );
}

export default ArticlePage;
