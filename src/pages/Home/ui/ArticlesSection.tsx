import { DataAwait } from '@shared/DataAwait';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import { ArticlePreview } from '@entities/article';
import type { AlbumsDeferred } from '@/routes/loaders/albumsLoader';

type ArticlesSectionProps = {
  data: AlbumsDeferred | null;
};

export function ArticlesSection({ data }: ArticlesSectionProps) {
  return (
    <section
      id="articles"
      className="articles main-background"
      aria-labelledby="home-articles-heading"
    >
      <div className="wrapper articles__wrapper">
        <h2 id="home-articles-heading">
          {data ? (
            <DataAwait value={data.templateC} fallback={<span>…</span>}>
              {(ui) => ui?.[0]?.titles?.articles}
            </DataAwait>
          ) : (
            <span>…</span>
          )}
        </h2>

        {data ? (
          <DataAwait
            value={data.templateB}
            fallback={<Loader />}
            error={<ErrorI18n code="articlesLoadFailed" />}
          >
            {(articles) => (
              <div className="articles__list">
                {articles.map((article) => (
                  <ArticlePreview key={article.articleId} {...article} />
                ))}
              </div>
            )}
          </DataAwait>
        ) : (
          <Loader />
        )}
      </div>
    </section>
  );
}
