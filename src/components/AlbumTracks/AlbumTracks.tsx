// src/components/AlbumTracks/AlbumTracks.tsx

import { useEffect } from 'react';
import { useState, MouseEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';

import { Hamburger, Popup } from '@components';
import AudioPlayer from '../AudioPlayer/AudioPlayer';

import type { IAlbums, TracksProps } from '../../models';
import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { useLang } from '../../contexts/lang';

import './style.scss';

/**
 * Компонент отображает название альбома и нумерованный список песен.
 * При клике на название трека выводит текст выбранной песни в popup.
 */
export default function AlbumTracks({ album }: { album: IAlbums }) {
  const [popupPlayer, setPopupPlayer] = useState(false); // показ попапа с аудиоплеером
  const [bgColor, setBgColor] = useState('rgba(var(--extra-background-color), 0.8)'); // фон попапа

  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из роутер-лоадера

  const location = useLocation();
  const navigate = useNavigate();
  const { trackId } = useParams<{ trackId?: string }>();

  // Синхронизация: если в URL #player → показываем попап, иначе скрываем
  useEffect(() => {
    setPopupPlayer(location.hash === '#player');
  }, [location.hash]);

  // Открывает попап с плеером (и не даёт всплыть клику до текста трека)
  function openPlayerPopup(e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
    navigate({
      pathname: location.pathname,
      search: location.search,
      hash: '#player',
    });
  }

  // Закрывает попап с плеером
  function closePopups() {
    if (location.hash === '#player') {
      if (window.history.length > 1) {
        navigate(-1); // обычный случай
      } else {
        navigate({ pathname: location.pathname, search: location.search }, { replace: true });
      }
    }
  }

  // Основной контент — принимает готовые строки UI (или дефолты)
  function Block({
    tracks,
    playText = 'Play',
    tracksTitle = 'Треки',
  }: {
    tracks: TracksProps[];
    playText?: string;
    tracksTitle?: string;
  }) {
    return (
      <>
        <h2 className="album-title">{album?.album}</h2>

        <div className="wrapper-album-play">
          <Link
            className="album-play"
            to={{ hash: '#player' }}
            aria-label="Кнопка play"
            aria-description="Открывает плеер"
          >
            <span className="icon-controller-play"></span>
            {playText}
          </Link>
        </div>

        <h3>{tracksTitle}</h3>

        {/* Рендерится кнопка на каждый трек. Активный подсвечивается. */}
        <div className="tracks">
          {tracks?.map((track) => (
            <Link
              key={track.id}
              to={`track/${track.id}`} // → /albums/:albumId/track/:trackId
              state={{ background: location }} // сохраняем фон для модалки
              className={clsx('tracks__btn', { active: String(track.id) === trackId })}
              aria-label="Кнопка с названием песни"
              aria-description={`Показать текст: ${track.title}`}
            >
              {track.title}
            </Link>
          ))}
        </div>

        {/* Попап с аудиоплеером */}
        {popupPlayer && (
          <Popup isActive={popupPlayer} bgColor={bgColor} onClose={closePopups}>
            {album && <AudioPlayer album={album} setBgColor={setBgColor} autoPlay />}
            <Hamburger isActive={popupPlayer} onToggle={closePopups} />
          </Popup>
        )}
      </>
    );
  }

  // Если данных от лоадера ещё нет — отрисуем блок с дефолтными подписями
  if (!data) {
    return <Block tracks={album?.tracks || []} />;
  }

  // Когда словарь подгрузится — возьмём тексты из него
  return (
    <DataAwait
      value={data.templateC}
      fallback={<Block tracks={album?.tracks || []} />}
      error={null}
    >
      {(ui) => {
        const dict = ui?.[0];
        const playText = dict?.buttons?.playButton ?? 'Play';
        const tracksTitle = dict?.titles?.tracks ?? 'Треки';
        return <Block tracks={album?.tracks || []} playText={playText} tracksTitle={tracksTitle} />;
      }}
    </DataAwait>
  );
}
