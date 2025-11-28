import './skeleton.scss';

export function AlbumPageSkeleton() {
  return (
    <section className="album main-background" aria-label="Блок c альбомом">
      <div className="wrapper album__wrapper">
        {/* 1. Breadcrumb "Главная" */}
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <ul>
            <li>
              <div className="skeleton skeleton--text skeleton--breadcrumb" />
            </li>
          </ul>
        </nav>

        {/* 2. Album cover, 3. Number "23", 8. Share icon */}
        <div className="item">
          <div className="skeleton skeleton--album-cover" />
          <div className="skeleton skeleton--album-number" />
          <div className="skeleton skeleton--share-button" />
        </div>

        {/* 4. Play button "Воспроизвести", 5. Track 1, 6. Track 2, 7. Track 3 */}
        <div className="item">
          <div className="wrapper-album-play">
            <div className="skeleton skeleton--play-button" />
          </div>
          <div className="tracks">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="tracks__btn"
                style={{ '--skeleton-index': index } as React.CSSProperties}
              >
                <div className="tracks__symbol">
                  <div className="skeleton skeleton--track-number" />
                </div>
                <div className="skeleton skeleton--text skeleton--track-title" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
