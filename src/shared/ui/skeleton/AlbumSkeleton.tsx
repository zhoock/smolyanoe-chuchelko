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

        <div className="item album-skeleton__tracks">
          <div className="skeleton skeleton--play-button-horizontal">
            <div className="skeleton skeleton--play-icon" />
            <div className="skeleton skeleton--play-text" />
          </div>
          <div className="album-skeleton__track-list">
            {Array.from({ length: tracksCount }).map((_, index) => (
              <div
                key={`track-${index}`}
                className="album-skeleton__track"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="skeleton skeleton--track-number" />
                <div className="album-skeleton__track-content">
                  <div className="skeleton skeleton--text skeleton--track-title" />
                  <div className="skeleton skeleton--text skeleton--track-duration" />
                  <div className="skeleton skeleton--text skeleton--track-extra" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
