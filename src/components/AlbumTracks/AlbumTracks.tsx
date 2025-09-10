// src/AlbumTracks.tsx

import React, { useState, MouseEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import clsx from 'clsx';
import Popup from '../Popup/Popup';
import Hamburger from '../Hamburger/Hamburger';
import AudioPlayer from '../AudioPlayer/AudioPlayer';
import { IAlbums, TracksProps } from '../../models';
import { useData } from '../../hooks/data';
import { useLang } from '../../hooks/useLang';
import './style.scss';

/**
 * Компонент отображает название альбома и нумерованный список песен.
 * При клике на название трека выводит текст выбранной песни в popup.
 */
export default function AlbumTracks({ album }: { album: IAlbums }) {
  const [popupPlayer, setPopupPlayer] = useState(false); // popupPlayer — отвечает за показ попапа с аудиоплеером.
  const [bgColor, setBgColor] = useState('rgba(var(--extra-background-color), 0.8)'); // bgColor — цвет фона для попапа с плеером (обновляется через AudioPlayer).

  const { lang } = useLang();
  const { templateData } = useData(lang);

  const location = useLocation();
  const { trackId } = useParams<{ trackId?: string }>();

  // Открывает попап с плеером.
  // e.stopPropagation() предотвращает открытие текстового попапа.
  function openPlayerPopup(e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
    setPopupPlayer(true);
  }

  // Закрывает оба попапа.
  // Сбрасывает активный трек.
  function closePopups() {
    setPopupPlayer(false);
  }

  // Основной контент — отображение названия альбома, кнопки "Воспроизвести" и списка треков.
  function Block({ tracks }: { tracks: TracksProps[] }) {
    return (
      <>
        <h2 className="album-title">{album?.album}</h2>

        <div className="wrapper-album-play">
          <button
            className="album-play"
            onClick={openPlayerPopup}
            type="button"
            aria-label="Кнопка play"
            aria-description="Открывает плеер"
          >
            <span className="icon-controller-play"></span>
            {templateData.templateC[0]?.buttons.playButton}
          </button>
        </div>

        <h3>{album?.tracks}</h3>

        {/* Рендерится кнопка на каждый трек. */}
        {/* Активный трек подсвечивается классом 'active'. */}
        <div className="tracks">
          {tracks?.map((track) => (
            <Link
              key={track.id}
              to={`track/${track.id}`} // → /albums/:albumId/track/:trackId
              state={{ background: location }} // важное: запоминаем фон
              className={clsx('tracks__btn', { active: String(track.id) === trackId })} // подсветка активного трека
              aria-label="Кнопка с названием песни"
              aria-description={`Показать текст: ${track.title}`}
            >
              {track.title}
            </Link>
          ))}
        </div>

        {/* Попап с аудиоплеером
        В AudioPlayer передаётся setBgColor, чтобы менять цвет фона попапа. 
        Hamburger для закрытия попапа. */}
        {popupPlayer && (
          <Popup isActive={popupPlayer} bgColor={bgColor} onClose={closePopups}>
            {album && <AudioPlayer album={album} setBgColor={setBgColor} autoPlay />}
            <Hamburger isActive={popupPlayer} onToggle={closePopups} />
          </Popup>
        )}
      </>
    );
  }

  return <Block {...album} />;
}
