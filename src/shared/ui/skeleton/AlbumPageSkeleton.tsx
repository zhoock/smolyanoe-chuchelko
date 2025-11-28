import './skeleton.scss';

export function AlbumPageSkeleton() {
  return (
    <section className="album main-background" aria-label="Блок c альбомом">
      <div className="wrapper album__wrapper">
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <ul>
            <li>
              <div className="skeleton skeleton--text skeleton--breadcrumb" />
            </li>
          </ul>
        </nav>

        <div className="item">
          <div className="skeleton skeleton--album-cover" />
          <div className="skeleton skeleton--album-number" />
          <div className="skeleton skeleton--share-button" />
        </div>

        <div className="item">
          <div className="skeleton skeleton--play-button" />
          <div className="tracks">
            <div className="tracks__btn">
              <div className="tracks__symbol">
                <div className="skeleton skeleton--track-number" />
              </div>
              <div className="skeleton skeleton--text skeleton--track-title" />
            </div>
            <div className="tracks__btn">
              <div className="tracks__symbol">
                <div className="skeleton skeleton--track-number" />
              </div>
              <div className="skeleton skeleton--text skeleton--track-title" />
            </div>
            <div className="tracks__btn">
              <div className="tracks__symbol">
                <div className="skeleton skeleton--track-number" />
              </div>
              <div className="skeleton skeleton--text skeleton--track-title" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
