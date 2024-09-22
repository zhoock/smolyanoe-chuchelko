import CoverList from "../CoverList/CoverList.jsx";
import Album from "./Album.jsx";
import AlbumDetails from "../AlbumDetails/AlbumDetails.jsx";

/**
 * Компонент отображает в зависимости от условия (showAlbum) — список альбомов
 * в виде обложек-ссылок,
 * либо выбранный альбом со всей информацией о нём.
 * @component
 * @param {Object} nameAlbum — Название альбома.
 * @param {boolean} showAlbum
 * @param {function} handleCoverClick — Функция берёт название альбома из тега h3
 * и меняет значение showAlbum на противоположное.
 * @returns
 */
export default function Albums({ nameAlbum, showAlbum, handleCoverClick }) {
  return (
    <section className="b-album">
      {showAlbum ? (
        <Album nameAlbum={nameAlbum} handleCoverClick={handleCoverClick} />
      ) : (
        <CoverList handleCoverClick={handleCoverClick} />
      )}

      {showAlbum && <AlbumDetails nameAlbum={nameAlbum} />}
    </section>
  );
}
