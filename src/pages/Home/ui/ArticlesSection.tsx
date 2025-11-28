import { ErrorI18n } from '@shared/ui/error-message';
import { ArticlesSkeleton } from '@shared/ui/skeleton/ArticlesSkeleton';
import { ArticlePreview } from '@entities/article';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectArticlesStatus, selectArticlesError, selectArticlesData } from '@entities/article';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';

export function ArticlesSection() {
  const { lang } = useLang();
  const articlesStatus = useAppSelector((state) => selectArticlesStatus(state, lang));
  const articlesError = useAppSelector((state) => selectArticlesError(state, lang));
  const articles = useAppSelector((state) => selectArticlesData(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

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
          <ArticlesSkeleton />
        ) : articlesStatus === 'failed' ? (
          <ErrorI18n code="articlesLoadFailed" />
        ) : (
          <div className="articles__list">
            {articles.map((article) => (
              <ArticlePreview key={article.articleId} {...article} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
