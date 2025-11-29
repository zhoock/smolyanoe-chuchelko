import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ErrorI18n } from '@shared/ui/error-message';
import { ArticlesSkeleton } from '@shared/ui/skeleton/ArticlesSkeleton';
import { ArticlePreview } from '@entities/article';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectArticlesStatus, selectArticlesData } from '@entities/article';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import './ArticlesSection.scss';

// Адаптивное количество статей для отображения на главной
const getInitialCount = () => {
  if (typeof window === 'undefined') return 12;
  if (window.innerWidth >= 1024) return 3; // десктоп (уменьшено для тестирования)
  if (window.innerWidth >= 768) return 12; // планшет
  return 6; // мобильный
};

export function ArticlesSection() {
  const { lang } = useLang();
  const articlesStatus = useAppSelector((state) => selectArticlesStatus(state, lang));
  const allArticles = useAppSelector((state) => selectArticlesData(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const [initialCount, setInitialCount] = useState(getInitialCount);

  // Обновляем количество при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      setInitialCount(getInitialCount());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayedArticles = allArticles.slice(0, initialCount);
  const hasMore = allArticles.length > initialCount;

  // Данные загружаются через loader, не нужно загружать здесь

  return (
    <section
      id="articles"
      className="articles main-background"
      aria-labelledby="home-articles-heading"
    >
      <div className="wrapper articles__wrapper">
        <h2 id="home-articles-heading">{ui?.titles?.articles ?? '…'}</h2>

        {articlesStatus === 'loading' || articlesStatus === 'idle' ? (
          <ArticlesSkeleton count={initialCount} />
        ) : articlesStatus === 'failed' ? (
          <ErrorI18n code="articlesLoadFailed" />
        ) : (
          <>
            <div className="articles__list">
              {displayedArticles.map((article) => (
                <ArticlePreview key={article.articleId} {...article} />
              ))}
            </div>

            {hasMore && (
              <div className="articles__more">
                <Link to="/articles" className="articles__more-button">
                  {lang === 'en'
                    ? `View all articles (${allArticles.length})`
                    : `Все статьи (${allArticles.length})`}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
