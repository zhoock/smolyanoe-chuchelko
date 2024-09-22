import { useState } from "react";
import Popup from "../Popup/Popup.jsx";
import Hamburger from "../Hamburger/Hamburger.jsx";
import { tracks } from "../data";

/**
 * Компонент отображает название альбома и нумерованный список песен.
 * При клике на название трека выводит текст выбранной песни в popup.
 * @component
 * @param {string} nameAlbum Название альбома.
 * @param {Object[]} tracks - Массив объектов с текстами песен альбома.
 * @param {string} tracks.title - Название трека.
 * @param {string} tracks.content - Текст песни.
 */
export default function AlbumTracks({ nameAlbum }) {
  const [activeTrack, setActiveTrack] = useState(null);
  const dataType = Number.isFinite(activeTrack);

  // Делегирование событий
  // Приём проектирования «поведение»
  function handleClick(e) {
    setActiveTrack(+e.target.dataset.index);
  }

  function Tracks({ tracks }) {
    return (
      <>
        <h2>{nameAlbum}</h2>
        <h3>Треки</h3>
        <ol onClick={handleClick}>
          {tracks.map((track) => (
            <li
              key={track.id}
              className={track.id === activeTrack ? "active" : null}
              data-index={track.id}
            >
              {track.title}
            </li>
          ))}
        </ol>

        {dataType && (
          <>
            <Popup isActive={dataType}>
              {/* опциональная цепочка */}
              <pre>{tracks[activeTrack]?.content.split("\n").join("\n")}</pre>
            </Popup>
            <Hamburger
              isActive={dataType}
              onShow={handleClick}
              zIndex={"1000"}
            />
          </>
        )}
      </>
    );
  }

  return <Tracks tracks={tracks(nameAlbum)} />;
}
