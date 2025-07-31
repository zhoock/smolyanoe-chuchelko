import React, { useState, MouseEvent } from 'react';
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
  const [activeTrack, setActiveTrack] = useState(0); // activeTrack — индекс активного трека (по умолчанию 0).
  const [popupText, setPopupText] = useState(false); // popupText — отвечает за показ попапа с текстом трека.
  const [popupPlayer, setPopupPlayer] = useState(false); // popupPlayer — отвечает за показ попапа с аудиоплеером.
  const [bgColor, setBgColor] = useState('rgba(var(--extra-background-color), 0.8)'); // bgColor — цвет фона для попапа с плеером (обновляется через AudioPlayer).
  const { lang } = useLang();
  const { templateData } = useData(lang);

  // Извлекает индекс трека из data-index и открывает текстовый попап.
  // -1 нужен, потому что индексация треков начинается с 1, а в массиве — с 0.
  function handleClick(e: MouseEvent<HTMLElement>) {
    setActiveTrack(Number(e.currentTarget.dataset.index) - 1);
    setPopupText(true);
  }

  // Открывает попап с плеером.
  // e.stopPropagation() предотвращает открытие текстового попапа.
  function openPlayerPopup(e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
    setPopupPlayer(true);
  }

  // Закрывает оба попапа.
  // Сбрасывает активный трек.
  function closePopups() {
    setPopupText(false);
    setPopupPlayer(false);
    setActiveTrack(0);
  }

  // Основной контент — отображение названия альбома, кнопки "Воспроизвести" и списка треков.
  function Block({ tracks }: { tracks: TracksProps[] }) {
    return (
      <>
        <h2 className="album-title">{album?.album}</h2>
        {/* <h3>Треки</h3> */}
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

        {/* Рендерится кнопка на каждый трек. */}
        {/* Активный трек подсвечивается классом 'active'. */}
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

        {/* Попап с текстом трека
        Используется <pre> — текст отображается с сохранением форматирования.
        Hamburger для закрытия попапа. */}
        <Popup isActive={popupText} onClose={closePopups}>
          <pre>{tracks?.[activeTrack]?.content}</pre>
          <Hamburger isActive={popupText} onToggle={closePopups} />
        </Popup>

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
