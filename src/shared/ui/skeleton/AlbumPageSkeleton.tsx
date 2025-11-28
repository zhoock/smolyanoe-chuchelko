import './skeleton.scss';

export function AlbumPageSkeleton() {
  return (
    <section className="album main-background" aria-label="Блок c альбомом">
      <div className="wrapper album__wrapper">
        {/* Breadcrumb skeleton */}
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <ul>
            <li>
              <div className="skeleton skeleton--text skeleton--breadcrumb" />
            </li>
          </ul>
        </nav>

        {/* Album cover skeleton */}
        <div className="item">
          <div className="skeleton skeleton--album-cover" />
        </div>

        {/* Album tracks skeleton */}
        <div className="item">
          <div className="skeleton skeleton--text skeleton--album-title" />
          <div className="tracks">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="tracks__btn"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="skeleton skeleton--text skeleton--track-title" />
              </div>
            ))}
          </div>
        </div>

        {/* Service buttons skeleton - Purchase */}
        <div className="item">
          <div className="service-buttons">
            <div className="skeleton skeleton--text skeleton--section-title" />
          </div>
        </div>

        {/* Service buttons skeleton - Stream */}
        <div className="item">
          <div className="service-buttons">
            <div className="skeleton skeleton--text skeleton--section-title" />
          </div>
        </div>
      </div>
    </section>
  );
}
