// src/components/AlbumTracks/AlbumTracks.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 * Компонент списка треков. Мемоизирован чтобы не перерендеривался при изменении других частей UI.
 * Использует подписку на store для обновления activeIndex без перерендера родителя.
 */
const TracksList = React.memo(function TracksList({
  tracks,
  album,
  activeIndex: initialActiveIndex,
  lyricsLabel,
  location,
  lang,
  openPlayer,
  store,
}: {
  tracks: TracksProps[];
  album: IAlbums;
  activeIndex: number;
  lyricsLabel: string;
  location: ReturnType<typeof useLocation>;
  lang: string;
  openPlayer: (index: number) => void;
  store: ReturnType<typeof useStore<RootState>>;
}) {
  const [activeIndex, setActiveIndex] = React.useState(initialActiveIndex);

  // Подписываемся на изменения activeIndex в store, чтобы обновлять только список треков
  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const newActiveIndex = store.getState().player.currentTrackIndex;
      setActiveIndex(newActiveIndex);
    });
    // Синхронизируем начальное значение
    setActiveIndex(store.getState().player.currentTrackIndex);
    return unsubscribe;
  }, [store]);
  return (
    <div className="tracks">
      {tracks?.map((track, index) => (
        <button
          key={track.id}
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
  );
});

/**
 * Компонент отображает список треков и управляет аудиоплеером.
 * Клик по треку запускает воспроизведение, меню открывает текст песни.
 * Мемоизирован чтобы не перерендеривался при изменении состояния плеера в Redux.
 */
const AlbumTracksComponent = ({ album }: { album: IAlbums }) => {
  const [popupPlayer, setPopupPlayer] = useState(false); // показ попапа с аудиоплеером
  const [bgColor, setBgColor] = useState('rgba(var(--extra-background-color-rgb) / 80%)'); // фон попапа
  const dispatch = useAppDispatch();
  const store = useStore<RootState>(); // получаем store для чтения состояния без перерендера

  // Читаем активный индекс напрямую из store через ref, чтобы не вызывать перерендер компонента
  const activeIndexRef = useRef(0);

  // Обновляем ref при изменении активного трека, но не вызываем перерендер
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const state = store.getState().player;
      activeIndexRef.current = state.currentTrackIndex;
    });
    // Синхронизируем начальное значение
    activeIndexRef.current = store.getState().player.currentTrackIndex;
    return unsubscribe;
  }, [store]);

  // Читаем playlist только для проверки длины (при открытии попапа)
  // Используем useRef для чтения без перерендера
  const playlistLengthRef = useRef(0);
  useEffect(() => {
    playlistLengthRef.current = store.getState().player.playlist.length;
  }, [store]);

  // albumId, albumTitle, currentTrackIndex, isPlaying, volume и playlist НЕ берём из селекторов
  // чтобы не вызывать перерендер при их изменении (смена трека, play/pause, изменение громкости)
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
    const playlistLength = store.getState().player.playlist.length;
    if (shouldBeOpen && playlistLength === 0 && album && album.tracks && album.tracks.length > 0) {
      const savedState = loadPlayerState();

      // Вычисляем albumId для текущего альбома
      const currentAlbumId =
        album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

      // Получаем текущее состояние из store для проверки
      const currentState = store.getState().player;

      // Проверяем, нужно ли восстанавливать (только если состояние пустое)
      if (currentState.playlist.length === 0) {
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
          dispatch(
            playerActions.setAlbumInfo({ albumId: currentAlbumId, albumTitle: album.album })
          );
          // При обычном открытии (не восстановление) запускаем трек
          dispatch(playerActions.requestPlay());
        }
      }
    }

    // НЕ сбрасываем bgColor при закрытии попапа - это предотвращает моргание
    // bgColor остаётся с последним значением для плавного закрытия
  }, [location.hash, album, dispatch, store]);

  // Сохраняем состояние плеера в localStorage при изменении ключевых параметров
  // Все значения читаем напрямую из store чтобы не вызывать перерендер
  // Используем подписку на store для отслеживания изменений без перерендера компонента
  useEffect(() => {
    let lastSavedState: {
      albumId: string | null;
      currentTrackIndex: number;
      playlistLength: number;
    } = {
      albumId: null,
      currentTrackIndex: -1,
      playlistLength: 0,
    };

    const unsubscribe = store.subscribe(() => {
      const state = store.getState().player;

      // Сохраняем только если изменились ключевые параметры
      if (
        state.albumId &&
        state.playlist.length > 0 &&
        (state.albumId !== lastSavedState.albumId ||
          state.currentTrackIndex !== lastSavedState.currentTrackIndex ||
          state.playlist.length !== lastSavedState.playlistLength)
      ) {
        savePlayerState({
          albumId: state.albumId,
          albumTitle: state.albumTitle,
          currentTrackIndex: state.currentTrackIndex,
          volume: state.volume,
          isPlaying: state.isPlaying,
          playlist: state.playlist,
        } as Parameters<typeof savePlayerState>[0]);

        lastSavedState = {
          albumId: state.albumId,
          currentTrackIndex: state.currentTrackIndex,
          playlistLength: state.playlist.length,
        };
      }
    });

    // Сохраняем начальное состояние
    const initialState = store.getState().player;
    if (initialState.albumId && initialState.playlist.length > 0) {
      savePlayerState({
        albumId: initialState.albumId,
        albumTitle: initialState.albumTitle,
        currentTrackIndex: initialState.currentTrackIndex,
        volume: initialState.volume,
        isPlaying: initialState.isPlaying,
        playlist: initialState.playlist,
      } as Parameters<typeof savePlayerState>[0]);

      lastSavedState = {
        albumId: initialState.albumId,
        currentTrackIndex: initialState.currentTrackIndex,
        playlistLength: initialState.playlist.length,
      };
    }

    return unsubscribe;
  }, [store]);

  const openPlayer = useCallback(
    (trackIndex: number) => {
      // Вычисляем уникальный ID альбома для аналитики
      const albumId =
        album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

      // Передаём плейлист и данные альбома в стор при открытии плеера
      // ВАЖНО: убеждаемся, что порядок треков в плейлисте соответствует порядку в UI
      const playlist = album.tracks || [];
      const selectedTrack = playlist[trackIndex];

      // Устанавливаем плейлист (он может быть перемешан, если shuffle включен)
      dispatch(playerActions.setPlaylist(playlist));

      // После установки плейлиста находим нужный трек в актуальном плейлисте (перемешанном или нет)
      // Это гарантирует правильный индекс даже при включенном shuffle
      if (selectedTrack) {
        const currentState = store.getState().player;
        const actualPlaylist = currentState.playlist;
        const actualIndex = actualPlaylist.findIndex((track) => track.id === selectedTrack.id);
        if (actualIndex !== -1) {
          dispatch(playerActions.setCurrentTrackIndex(actualIndex));
        } else {
          // Если трек не найден (не должно происходить), используем переданный индекс
          dispatch(playerActions.setCurrentTrackIndex(trackIndex));
        }
      } else {
        dispatch(playerActions.setCurrentTrackIndex(trackIndex));
      }

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
  // Мемоизируем чтобы не пересоздавался при каждом рендере
  const closePopups = useCallback(() => {
    if (location.hash === '#player') {
      if (window.history.length > 1) {
        navigate(-1); // обычный случай
      } else {
        navigate({ pathname: location.pathname, search: location.search }, { replace: true });
      }
    }
  }, [location.hash, location.pathname, location.search, navigate]);

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
    // Мемоизируем статичные части, которые не должны перерендериваться при смене трека
    const albumHeader = useMemo(
      () => (
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
        </>
      ),
      [album, playText, lang, openPlayer] // только эти зависимости влияют на заголовок и кнопку
    );

    return (
      <>
        {albumHeader}

        {/* <h3>{tracksTitle}</h3> */}

        {/* Рендерится кнопка на каждый трек. Активный подсвечивается. */}
        {/* Выносим в отдельный компонент чтобы он не перерендеривался при смене activeIndex */}
        <TracksList
          tracks={tracks}
          album={album}
          activeIndex={activeIndexRef.current}
          lyricsLabel={lyricsLabel}
          location={location}
          lang={lang}
          openPlayer={openPlayer}
          store={store}
        />

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
};

// Мемоизируем компонент чтобы предотвратить перерендер при изменении состояния плеера
// Компонент перерендерится только если изменился проп album
export default React.memo(AlbumTracksComponent, (prevProps, nextProps) => {
  // Перерендериваем только если изменился альбом
  return prevProps.album.albumId === nextProps.album.albumId;
});
