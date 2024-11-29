import React, { useEffect, useState, MouseEvent } from "react";
import Popup from "../Popup/Popup";
import Hamburger from "../Hamburger/Hamburger";
import { TracksProps } from "../../models";
import { IAlbums } from "../../models";
import "./style.scss";

/**
 * Компонент отображает название альбома и нумерованный список песен.
 * При клике на название трека выводит текст выбранной песни в popup.
 */
export default function AlbumTracks({ album }: { album: IAlbums }) {
  const [activeTrack, setActiveTrack] = useState(0);
  const [popup, setPopup] = useState(false);

  // Делегирование событий
  // Приём проектирования «поведение»
  function handleClick(e: MouseEvent<HTMLElement>) {
    setActiveTrack(Number(e.currentTarget.dataset.index) - 1);
    setPopup(!popup);
  }

  function hamburgerClick() {
    setPopup(!popup);
    setActiveTrack(0);
  }

  function Block({ tracks }: { tracks: TracksProps[] }) {
    return (
      <>
        <h2>{album?.nameAlbum}</h2>
        <h3>Треки</h3>

        <div className="tracks">
          {tracks?.map((track) => (
            <button
              key={track.id}
              className={track.id === activeTrack ? "active" : ""}
              data-index={track.id}
              onClick={handleClick}
            >
              <span className="track-number">{track.id}</span> {track.title}
            </button>
          ))}
        </div>

        {popup && (
          <>
            <Popup isActive={popup}>
              <pre>
                {typeof activeTrack === "number" &&
                  tracks[activeTrack]?.content.split("\n").join("\n")}
              </pre>
            </Popup>
            <Hamburger
              isActive={popup}
              onToggle={hamburgerClick}
              zIndex={"1000"}
            />
          </>
        )}
      </>
    );
  }

  return <Block {...album} />;
}
