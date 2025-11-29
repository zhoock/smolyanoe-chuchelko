import './ArticlesSkeleton.scss';

interface ArticlesSkeletonProps {
  count?: number;
}

export function ArticlesSkeleton({ count = 6 }: ArticlesSkeletonProps) {
  return (
    <div className="articles__list">
      {Array.from({ length: count }).map((_, index) => (
        <article key={index} className="articles__card">
          <div className="articles__picture">
            <div className="skeleton skeleton--article-image" />
          </div>
          <div className="articles__description">
            <div className="skeleton skeleton--text skeleton--title" />
            <div className="skeleton skeleton--text skeleton--date" />
          </div>
        </article>
      ))}
    </div>
  );
}
