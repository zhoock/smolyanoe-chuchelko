import AlbumDetailsReleased from "./AlbumDetailsReleased.jsx";
import AlbumDetailsArtwork from "./AlbumDetailsArtwork.jsx";
import AlbumDetailsMusic from "./AlbumDetailsMusic.jsx";

/**
 * Компонент отображает дополнительные данные об альбоме.
 * @component
 * @param {string} nameAlbum - Название альбома.
 */
export default function AlbumDetails(nameAlbum) {
  return (
    <section className="b-album-details">
      <div className="row">
        <div className="small-12 small-centered column">
          <div className="row">
            <div className="large-5 large-push-7 column">
              <div className="b-album-details__released">
                <h2>Релиз</h2>
                <AlbumDetailsReleased {...nameAlbum} />
                <hr />
              </div>
              <div className="b-album-details__artwork">
                <h2>Обложка альбома</h2>
                <AlbumDetailsArtwork {...nameAlbum} />
                <hr />
              </div>
            </div>
            <div className="large-7 large-pull-5 column">
              <div className="b-album-details__music">
                <h2>Музыка</h2>
                <AlbumDetailsMusic {...nameAlbum} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
