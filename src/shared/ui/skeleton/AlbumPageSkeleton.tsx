import './skeleton.scss';

export function AlbumPageSkeleton() {
  return (
    <section className="album main-background" aria-label="Блок c альбомом">
      <div className="wrapper album__wrapper">
        {/* Album cover skeleton */}
        <div className="item">
          <div className="skeleton skeleton--album-cover" />
        </div>

        {/* Album tracks skeleton */}
        <div className="item">
          <div className="wrapper-album-play">
            <div className="skeleton skeleton--play-button" />
          </div>
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
      </div>
    </section>
  );
}
