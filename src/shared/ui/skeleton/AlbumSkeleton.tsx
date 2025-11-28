import './skeleton.scss';

interface AlbumSkeletonProps {
  tracksCount?: number;
}

export function AlbumSkeleton({ tracksCount = 3 }: AlbumSkeletonProps) {
  return (
    <section className="album main-background" aria-label="Скелетон альбома">
      <div className="wrapper album__wrapper album-skeleton">
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <div className="album-skeleton__breadcrumb">
            <div className="skeleton skeleton--text skeleton--breadcrumb skeleton--breadcrumb-top" />
            <div className="skeleton skeleton--text skeleton--breadcrumb skeleton--breadcrumb-bottom" />
          </div>
        </nav>

        <div className="item album-skeleton__cover-block">
          <div className="album-skeleton__cover">
            <div className="skeleton skeleton--album-cover" />
          </div>
        </div>

        <div className="item">
          <h2 className="album-title">
            <div className="skeleton skeleton--text skeleton--album-title" />
          </h2>

          <div className="wrapper-album-play">
            <div className="skeleton skeleton--play-button-horizontal">
              <div className="skeleton skeleton--play-icon" />
              <div className="skeleton skeleton--play-text" />
            </div>
          </div>

          <div className="tracks">
            {Array.from({ length: tracksCount }).map((_, index) => (
              <div
                key={`track-${index}`}
                className="tracks__btn"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="tracks__symbol">
                  <div className="skeleton skeleton--track-number" />
                </div>
                <div className="tracks__title">
                  <div className="skeleton skeleton--text skeleton--track-title" />
                </div>
                <div className="tracks__duration">
                  <div className="skeleton skeleton--text skeleton--track-duration" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
