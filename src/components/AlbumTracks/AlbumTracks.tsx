// src/components/AlbumTracks/AlbumTracks.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useStore } from 'react-redux';
import type { AppStore, RootState } from '@app/providers/StoreProvider/config/store';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, playerSelectors, savePlayerState, loadPlayerState } from '@features/player';

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
  const store = useStore<RootState>(); // получаем store для чтения volume без перерендера
  const activeIndex = useAppSelector(playerSelectors.selectCurrentTrackIndex);
  const playlist = useAppSelector(playerSelectors.selectPlaylist);
  // Используем отдельные селекторы для сохранения состояния
  const albumId = useAppSelector((state) => state.player.albumId);
  const albumTitle = useAppSelector((state) => state.player.albumTitle);
  const currentTrackIndex = useAppSelector(playerSelectors.selectCurrentTrackIndex);

  // isPlaying и volume НЕ берём из селекторов чтобы не вызывать перерендер при их изменении
  // Читаем их напрямую из store только при сохранении

  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из роутер-лоадера

  const location = useLocation();
  const navigate = useNavigate();

  // Синхронизация: если в URL #player → показываем попап, иначе скрываем
  useEffect(() => {
    const shouldBeOpen = location.hash === '#player';
    setPopupPlayer(shouldBeOpen);

    // Если попап открыт при загрузке страницы, но в Redux нет данных о треке,
    // восстанавливаем состояние из localStorage
    if (shouldBeOpen && playlist.length === 0 && album && album.tracks && album.tracks.length > 0) {
      const savedState = loadPlayerState();

      // Вычисляем albumId для текущего альбома
      const currentAlbumId =
        album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

      if (savedState && savedState.albumId === currentAlbumId) {
        // Если сохранённый альбом совпадает с текущим, восстанавливаем конкретный трек
        const validTrackIndex = Math.max(
          0,
          Math.min(savedState.currentTrackIndex, album.tracks.length - 1)
        );

        // Восстанавливаем состояние трека
        dispatch(playerActions.setPlaylist(album.tracks));
        dispatch(playerActions.setCurrentTrackIndex(validTrackIndex));
        dispatch(
          playerActions.setAlbumInfo({
            albumId: savedState.albumId,
            albumTitle: savedState.albumTitle ?? album.album,
          })
        );
        dispatch(playerActions.setVolume(savedState.volume));

        // ВАЖНО: Всегда ставим трек на паузу при восстановлении из localStorage
        // Это гарантирует правильное состояние и классы, даже если трек до этого играл
        dispatch(playerActions.pause());
      } else {
        // Если сохранённого состояния нет или альбом не совпадает, используем первый трек
        dispatch(playerActions.setPlaylist(album.tracks));
        dispatch(playerActions.setCurrentTrackIndex(0));
        dispatch(playerActions.setAlbumInfo({ albumId: currentAlbumId, albumTitle: album.album }));
        // При обычном открытии (не восстановление) запускаем трек
        dispatch(playerActions.requestPlay());
      }
    }

    // НЕ сбрасываем bgColor при закрытии попапа - это предотвращает моргание
    // bgColor остаётся с последним значением для плавного закрытия
  }, [location.hash, playlist.length, album, dispatch]);

  // Сохраняем состояние плеера в localStorage при изменении ключевых параметров
  // volume и isPlaying читаем напрямую из store чтобы не вызывать перерендер при их изменении
  useEffect(() => {
    if (albumId && playlist.length > 0) {
      const state = store.getState().player;
      const currentVolume = state.volume; // читаем напрямую из store
      const currentIsPlaying = state.isPlaying; // читаем напрямую из store
      savePlayerState({
        albumId,
        albumTitle,
        currentTrackIndex,
        volume: currentVolume,
        isPlaying: currentIsPlaying,
        playlist,
      } as Parameters<typeof savePlayerState>[0]);
    }
  }, [albumId, albumTitle, currentTrackIndex, playlist.length, store]); // store стабилен, не вызывает перерендер

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
