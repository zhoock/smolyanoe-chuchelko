import AlbumCover from "../CoverList/AlbumCover.jsx";
import AlbumTracks from "../AlbumTracks/AlbumTracks.jsx";
import Share from "../Share/Share.jsx";
import ServiceButtons from "../ServiceButtons/ServiceButtons.jsx";

/**
 * Компонент отображает основные сведения об альбоме (обложку, список треков,
 * кнопки(ссылки) на музыкальные агрегаторы.
 * @component
 * @param {string} nameAlbum - Название альбома.
 * @param {function} handleCoverClick — Функция берёт название альбома из тега h3
 * и меняет значение showAlbum на противоположное
 */
export default function Album({ nameAlbum, handleCoverClick }) {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });

  return (
    <>
      <div className="row">
        <div className="small-12 column">
          <nav aria-label="Breadcrumb" className="b-breadcrumb">
            <ul>
              <li>
                <a href="#" onClick={handleCoverClick}>
                  Альбомы
                </a>
              </li>
              <li className="active">{nameAlbum}</li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="row">
        <div className="small-12 medium-6 medium-push-6 column">
          <AlbumCover nameAlbum={nameAlbum} />

          <Share />
        </div>

        <div className="small-12 medium-6 medium-pull-6 column">
          <AlbumTracks nameAlbum={nameAlbum} />
        </div>
      </div>
      <div className="row">
        <div className="small-12 medium-6 column">
          <ServiceButtons nameAlbum={nameAlbum} section="Купить" />
        </div>
        <div className="small-12 medium-6 column">
          <ServiceButtons nameAlbum={nameAlbum} section="Слушать" />
        </div>
      </div>
    </>
  );
}
