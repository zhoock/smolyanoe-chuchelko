import './skeleton.scss';

interface AlbumSkeletonProps {
  tracksCount?: number;
  buyButtons?: number;
  listenButtons?: number;
}

export function AlbumSkeleton({
  tracksCount = 4,
  buyButtons = 2,
  listenButtons = 3,
}: AlbumSkeletonProps) {
  return (
    <section className="album main-background" aria-label="Скелетон альбома">
      <div className="wrapper album__wrapper album-skeleton">
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <div className="skeleton skeleton--text skeleton--breadcrumb" />
        </nav>

        <div className="item album-skeleton__cover-block">
          <div className="album-skeleton__cover">
            <div className="skeleton skeleton--album-cover" />
          </div>
          <div className="album-skeleton__share">
            <div className="skeleton skeleton--pill" />
          </div>
        </div>

        <div className="item album-skeleton__tracks">
          <div className="skeleton skeleton--text skeleton--section-title" />
          <div className="album-skeleton__track-list">
            {Array.from({ length: tracksCount }).map((_, index) => (
              <div
                key={`track-${index}`}
                className="album-skeleton__track"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="skeleton skeleton--circle" />
                <div className="skeleton skeleton--text skeleton--full-width" />
              </div>
            ))}
          </div>
        </div>

        <div className="item album-skeleton__services">
          <div className="skeleton skeleton--text skeleton--section-title" />
          <div className="service-buttons__list">
            {Array.from({ length: buyButtons }).map((_, index) => (
              <div
                key={`buy-${index}`}
                className="service-buttons__list-item"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="skeleton skeleton--service-button" />
              </div>
            ))}
          </div>
        </div>

        <div className="item album-skeleton__services">
          <div className="skeleton skeleton--text skeleton--section-title" />
          <div className="service-buttons__list">
            {Array.from({ length: listenButtons }).map((_, index) => (
              <div
                key={`listen-${index}`}
                className="service-buttons__list-item"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="skeleton skeleton--service-button" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="album-skeleton__details">
        <div className="wrapper">
          <div className="skeleton skeleton--text skeleton--section-title" />
          <div className="album-skeleton__paragraphs">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`paragraph-${index}`}
                className="skeleton skeleton--text skeleton--paragraph"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
