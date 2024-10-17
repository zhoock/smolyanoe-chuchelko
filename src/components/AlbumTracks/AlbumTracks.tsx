import React, { useState, MouseEvent } from "react";
import Popup from "../Popup/Popup";
import Hamburger from "../Hamburger/Hamburger";
import { tracks } from "../data";
import { AlbumsProps } from "../../models";
import { TracksProps } from "../../models";

/**
 * Компонент отображает название альбома и нумерованный список песен.
 * При клике на название трека выводит текст выбранной песни в popup.
 */
export default function AlbumTracks({ nameAlbum }: AlbumsProps) {
  const initialState: unknown = null;
  const [activeTrack, setActiveTrack] = useState(initialState);
  const [showPopup, setShowPopup] = useState(false);

  // Делегирование событий
  // Приём проектирования «поведение»
  function handleClick(e: MouseEvent<HTMLElement>) {
    if (e.currentTarget instanceof HTMLLIElement) {
      setActiveTrack(Number(e.currentTarget.dataset.index) - 1);
      setShowPopup(!showPopup);
    } else {
      setActiveTrack(!!activeTrack);
      setShowPopup(!showPopup);
    }
  }

  function Tracks({ tracks }: { tracks: TracksProps[] }) {

    return (
      <>
        <h2>{nameAlbum}</h2>
        <h3>Треки</h3>
        <ol>
          {tracks.map((track) => (
            <li
              key={track.id}
              className={track.id === activeTrack ? "active" : ""}
              data-index={track.id}
              onClick={handleClick}
            >
              {track.title}
            </li>
          ))}
        </ol>

        {typeof activeTrack === "number" && (
          <>
            <Popup isActive={showPopup}>
              {/* опциональная цепочка */}
              <pre>{tracks[activeTrack]?.content.split("\n").join("\n")}</pre>
            </Popup>
            <Hamburger
              isActive={showPopup}
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
