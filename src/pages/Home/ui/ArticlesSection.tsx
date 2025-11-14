import { useEffect } from 'react';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import { ArticlePreview } from '@entities/article';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import {
  fetchArticles,
  selectArticlesStatus,
  selectArticlesError,
  selectArticlesData,
} from '@entities/article';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryFirst,
} from '@shared/model/uiDictionary';

export function ArticlesSection() {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const articlesStatus = useAppSelector((state) => selectArticlesStatus(state, lang));
  const articlesError = useAppSelector((state) => selectArticlesError(state, lang));
  const articles = useAppSelector((state) => selectArticlesData(state, lang));
  const uiStatus = useAppSelector((state) => selectUiDictionaryStatus(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  useEffect(() => {
    if (articlesStatus === 'idle' || articlesStatus === 'failed') {
      const promise = dispatch(fetchArticles({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, articlesStatus]);

  useEffect(() => {
    if (uiStatus === 'idle' || uiStatus === 'failed') {
      const promise = dispatch(fetchUiDictionary({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, uiStatus]);

  return (
    <section
      id="articles"
      className="articles main-background"
      aria-labelledby="home-articles-heading"
    >
      <div className="wrapper articles__wrapper">
        <h2 id="home-articles-heading">{ui?.titles?.articles ?? '…'}</h2>

        {articlesStatus === 'loading' || articlesStatus === 'idle' ? (
          <Loader />
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
