import React, { useState, MouseEvent } from 'react';
import Popup from '../Popup/Popup';
import Hamburger from '../Hamburger/Hamburger';
import AudioPlayer from '../AudioPlayer/AudioPlayer';
import { IAlbums, TracksProps } from '../../models';
import './style.scss';

/**
 * Компонент отображает название альбома и нумерованный список песен.
 * При клике на название трека выводит текст выбранной песни в popup.
 */
export default function AlbumTracks({ album }: { album: IAlbums }) {
  const [activeTrack, setActiveTrack] = useState(0);
  const [popupText, setPopupText] = useState(false);
  const [popupPlayer, setPopupPlayer] = useState(false);

  function handleClick(e: MouseEvent<HTMLElement>) {
    setActiveTrack(Number(e.currentTarget.dataset.index) - 1);
    setPopupText(true);
  }

  function openPlayerPopup(e: MouseEvent<HTMLElement>) {
    e.stopPropagation(); // Чтобы не срабатывал handleClick
    setPopupPlayer(true);
  }

  function hamburgerClick() {
    setPopupText(false);
    setPopupPlayer(false);
    setActiveTrack(0);
  }

  function Block({ tracks }: { tracks: TracksProps[] }) {
    return (
      <>
        <h2 className="album-title">{album?.nameAlbum}</h2>
        <h3>Треки</h3>
        {/* <button
          className="album-play"
          onClick={openPlayerPopup}
          type="button"
          aria-label="Кнопка play"
          aria-description="Открывает плеер"
        >
          Воспроизвести
        </button> */}

        <div className="tracks">
          {tracks?.map((track) => (
            <button
              key={track.id}
              className={`tracks__btn ${track.id === activeTrack ? 'active' : ''}`}
              data-index={track.id}
              onClick={handleClick}
              type="button"
              aria-label="Кнопка с названием песни"
              aria-description="Показать текст песни"
            >
              {track.title}
            </button>
          ))}
        </div>

        {popupText && (
          <Popup isActive={popupText}>
            <pre>
              {typeof activeTrack === 'number' && tracks[activeTrack]?.content}
            </pre>
            <Hamburger
              isActive={popupText}
              onToggle={hamburgerClick}
              zIndex="1000"
            />
          </Popup>
        )}

        {popupPlayer && (
          <Popup isActive={popupPlayer}>
            <AudioPlayer album={album} />
            <Hamburger
              isActive={popupPlayer}
              onToggle={hamburgerClick}
              zIndex="1000"
            />
          </Popup>
        )}
      </>
    );
  }

  return <Block {...album} />;
}
