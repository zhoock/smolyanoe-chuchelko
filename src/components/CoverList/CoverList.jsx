import { ALBUMSDATA } from "../data.js";
import AlbumCover from "./AlbumCover.jsx";

/**
 * Компонент отображает блок с обложками альбомов.
 * @component
 * @param {function} handleCoverClick — Функция берёт название альбома из заголовка h3
 * и меняет булево значение showAlbum.
 */
export default function CoverList({ handleCoverClick }) {
  // alert(JSON.stringify(ALBUMSDATA.length));

  function Cover({ handleCoverClick, nameAlbum, fullName, children, year }) {
    return (
      <div className="b-cover__img">
        {children}
        <h3 onClick={handleCoverClick}>{nameAlbum}</h3>
        <div className="b-cover__name-group">{fullName}</div>
        <div className="b-cover__name-album">{year.slice(0, 4)}</div>
      </div>
    );
  }

  return (
    <>
      <div className="row collapse medium-uncollapse">
        <div className="small-12 small-centered column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Альбомы</h2>
            </div>
          </div>
          <div className="b-cover-list">
            {ALBUMSDATA.map((album, i) => (
              <Cover
                key={i}
                handleCoverClick={handleCoverClick}
                nameAlbum={album.nameAlbum}
                fullName={album.fullName}
                year={album.release[0].date}
              >
                <AlbumCover
                  nameAlbum={album.nameAlbum}
                  nameCover={album.nameCover}
                />
              </Cover>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
