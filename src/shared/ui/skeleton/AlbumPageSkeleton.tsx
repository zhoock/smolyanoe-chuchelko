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

        {/* 2. Album cover */}
        <div className="item">
          <div className="skeleton skeleton--album-cover" />
        </div>

        {/* 3. Number "23" */}
        <div className="item">
          <div className="skeleton skeleton--album-number" />
        </div>

        {/* 4. Play button "Воспроизвести" */}
        <div className="item">
          <div className="wrapper-album-play">
            <div className="skeleton skeleton--play-button" />
          </div>
        </div>

        {/* 5. Track 1 */}
        <div className="item">
          <div className="tracks">
            <div className="tracks__btn">
              <div className="skeleton skeleton--text skeleton--track-title" />
            </div>
          </div>
        </div>

        {/* 6. Track 2 */}
        <div className="item">
          <div className="tracks">
            <div className="tracks__btn">
              <div className="skeleton skeleton--text skeleton--track-title" />
            </div>
          </div>
        </div>

        {/* 7. Track 3 */}
        <div className="item">
          <div className="tracks">
            <div className="tracks__btn">
              <div className="skeleton skeleton--text skeleton--track-title" />
            </div>
          </div>
        </div>

        {/* 8. Share icon */}
        <div className="item">
          <div className="skeleton skeleton--share-button" />
        </div>
      </div>
    </section>
  );
}
