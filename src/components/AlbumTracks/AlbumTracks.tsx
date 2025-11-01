// src/components/AlbumTracks/AlbumTracks.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, playerSelectors } from '@features/player';

import { Hamburger, Popup } from '@components';
import { AudioPlayer } from '@features/player';

import type { IAlbums, TracksProps } from '../../models';
import { useAlbumsData } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import { gaEvent } from '../../utils/ga';

import './style.scss';

/**
 * Форматирует продолжительность трека из формата mm.ss → mm:ss.
 */
function formatDuration(duration?: number): string {
  if (duration == null) return '';
  const [minutes, rawSeconds = '0'] = duration.toString().split('.');
  const normalizedSeconds =
    rawSeconds.length === 1 ? `${rawSeconds}0` : rawSeconds.slice(0, 2).padEnd(2, '0');
  return `${minutes}:${normalizedSeconds}`;
}

/**
 * Компонент отображает список треков и управляет аудиоплеером.
 * Клик по треку запускает воспроизведение, меню открывает текст песни.
 */
export default function AlbumTracks({ album }: { album: IAlbums }) {
  const [popupPlayer, setPopupPlayer] = useState(false); // показ попапа с аудиоплеером
  const [bgColor, setBgColor] = useState('rgba(var(--extra-background-color-rgb) / 80%)'); // фон попапа
  const dispatch = useAppDispatch();
  const activeIndex = useAppSelector(playerSelectors.selectCurrentTrackIndex);

  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из роутер-лоадера

  const location = useLocation();
  const navigate = useNavigate();

  // Синхронизация: если в URL #player → показываем попап, иначе скрываем
  useEffect(() => {
    const shouldBeOpen = location.hash === '#player';
    setPopupPlayer(shouldBeOpen);

    // НЕ сбрасываем bgColor при закрытии попапа - это предотвращает моргание
    // bgColor остаётся с последним значением для плавного закрытия
  }, [location.hash]);

  const openPlayer = useCallback(
    (trackIndex: number) => {
      // Вычисляем уникальный ID альбома для аналитики
      const albumId =
        album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

      // Передаём плейлист и данные альбома в стор при открытии плеера
      dispatch(playerActions.setPlaylist(album.tracks || []));
      dispatch(playerActions.setCurrentTrackIndex(trackIndex));
      dispatch(playerActions.setAlbumInfo({ albumId, albumTitle: album.album }));
      dispatch(playerActions.requestPlay());
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: '#player',
        },
        { replace: location.hash === '#player' }
      );
    },
    [dispatch, album, location.hash, location.pathname, location.search, navigate]
  );

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
    lyricsLabel,
  }: {
    tracks: TracksProps[];
    playText?: string;
    tracksTitle?: string;
    lyricsLabel: string;
  }) {
    return (
      <>
        <h2 className="album-title">{album?.album}</h2>

        <div className="wrapper-album-play">
          <button
            type="button"
            className="album-play"
            aria-label="Кнопка play"
            aria-description="Открывает плеер"
            onClick={() => {
              gaEvent('player_open', {
                album_id: album?.albumId,
                album_title: album?.album,
                lang,
              });
              openPlayer(0);
            }}
          >
            <span className="icon-controller-play"></span>
            {playText}
          </button>
        </div>

        {/* <h3>{tracksTitle}</h3> */}

        {/* Рендерится кнопка на каждый трек. Активный подсвечивается. */}
        <div className="tracks">
          {tracks?.map((track, index) => (
            <button
              type="button"
              className={clsx('tracks__btn', { active: activeIndex === index })}
              aria-label="Кнопка с названием песни"
              aria-description={`Воспроизвести: ${track.title}`}
              onClick={() => {
                gaEvent('track_select', {
                  album_id: album?.albumId,
                  album_title: album?.album,
                  track_id: track.id,
                  track_title: track.title,
                  lang,
                });
                openPlayer(index);
              }}
            >
              <span className="tracks__title">{track.title}</span>
              {/* {track.duration != null && (
                <span className="tracks__duration">{formatDuration(track.duration)}</span>
              )} */}
              <Link
                to={{
                  pathname: `/albums/${album.albumId}/track/${track.id}`,
                  search: location.search,
                  hash: location.hash === '#player' ? '#player' : undefined,
                }}
                state={{ background: location }}
                className="tracks__menu"
                aria-label={`${lyricsLabel}: ${track.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <span aria-hidden="true">⋯</span>
              </Link>
            </button>
          ))}
        </div>

        {/* Попап с аудиоплеером */}
        <Popup isActive={popupPlayer} bgColor={bgColor} onClose={closePopups}>
          {popupPlayer && album && <AudioPlayer album={album} setBgColor={setBgColor} />}
          <Hamburger isActive={popupPlayer} onToggle={closePopups} />
        </Popup>
      </>
    );
  }

  const defaultLyricsLabel = useMemo(
    () => (lang === 'en' ? 'Show lyrics' : 'Показать текст'),
    [lang]
  );

  // Если данных от лоадера ещё нет — отрисуем блок с дефолтными подписями
  if (!data) {
    return <Block tracks={album?.tracks || []} lyricsLabel={defaultLyricsLabel} />;
  }

  // Когда словарь подгрузится — возьмём тексты из него
  return (
    <DataAwait
      value={data.templateC}
      fallback={<Block tracks={album?.tracks || []} lyricsLabel={defaultLyricsLabel} />}
      error={null}
    >
      {(ui) => {
        const dict = ui?.[0];
        const playText = dict?.buttons?.playButton ?? 'Play';
        const tracksTitle = dict?.titles?.tracks ?? 'Треки';
        const lyricsLabel =
          dict?.buttons?.lyrics ?? (lang === 'en' ? 'Show lyrics' : 'Показать текст');
        return (
          <Block
            tracks={album?.tracks || []}
            playText={playText}
            tracksTitle={tracksTitle}
            lyricsLabel={lyricsLabel}
          />
        );
      }}
    </DataAwait>
  );
}
