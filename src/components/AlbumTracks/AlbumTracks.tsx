// src/components/AlbumTracks/AlbumTracks.tsx
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useStore } from 'react-redux';
import type { AppStore, RootState } from '@app/providers/StoreProvider/config/store';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { playerActions, playerSelectors, savePlayerState, loadPlayerState } from '@features/player';

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
  location,
  lang,
  openPlayer,
  store,
}: {
  tracks: TracksProps[];
  album: IAlbums;
  activeIndex: number;
  location: ReturnType<typeof useLocation>;
  lang: string;
  openPlayer: (index: number) => void;
  store: ReturnType<typeof useStore<RootState>>;
}) {
  const [activeIndex, setActiveIndex] = React.useState(initialActiveIndex);
  const [isPlaying, setIsPlaying] = React.useState(store.getState().player.isPlaying);
  const [currentTrackId, setCurrentTrackId] = React.useState<string | number | null>(() => {
    const playerState = store.getState().player;
    return playerState.playlist[playerState.currentTrackIndex]?.id ?? null;
  });
  const [currentAlbumId, setCurrentAlbumId] = React.useState<string | null>(
    store.getState().player.albumId ?? null
  );

  const albumUniqueId = React.useMemo(
    () => album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-'),
    [album.albumId, album.artist, album.album]
  );

  // Подписываемся на изменения activeIndex в store, чтобы обновлять только список треков
  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const playerState = store.getState().player;
      setActiveIndex(playerState.currentTrackIndex);
      setIsPlaying(playerState.isPlaying);
      setCurrentAlbumId(playerState.albumId ?? null);
      setCurrentTrackId(playerState.playlist[playerState.currentTrackIndex]?.id ?? null);
    });
    // Синхронизируем начальное значение
    const initialState = store.getState().player;
    setActiveIndex(initialState.currentTrackIndex);
    setIsPlaying(initialState.isPlaying);
    setCurrentAlbumId(initialState.albumId ?? null);
    setCurrentTrackId(initialState.playlist[initialState.currentTrackIndex]?.id ?? null);
    return unsubscribe;
  }, [store]);
  return (
    <div className="tracks">
      {tracks?.map((track, index) => {
        const isCurrentAlbum = currentAlbumId === albumUniqueId;
        const isActive = isCurrentAlbum && activeIndex === index;
        const isPlayingNow = isCurrentAlbum && isPlaying && currentTrackId === track.id;

        return (
          <button
            key={track.id}
            type="button"
            className={clsx('tracks__btn', {
              active: isActive,
              'tracks__btn--playing': isPlayingNow,
            })}
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
            {isPlayingNow ? (
              <span className="tracks__equalizer" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            ) : (
              <span className="tracks__index">{index + 1}</span>
            )}
            <span className="tracks__title">{track.title}</span>
            {track.duration != null && (
              <span className="tracks__duration">{formatDuration(track.duration)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
});

/**
 * Компонент отображает список треков и управляет аудиоплеером.
 * Клик по треку запускает воспроизведение, меню открывает текст песни.
 * Мемоизирован чтобы не перерендеривался при изменении состояния плеера в Redux.
 */
const AlbumTracksComponent = ({ album }: { album: IAlbums }) => {
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

  useEffect(() => {
    const shouldBeOpen = location.hash === '#player';

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
          dispatch(
            playerActions.setAlbumMeta({
              albumId: savedState.albumId,
              album: album.album,
              artist: album.artist,
              fullName: album.fullName ?? `${album.artist} — ${album.album}`,
              cover: album.cover ?? null,
            })
          );
          dispatch(
            playerActions.setSourceLocation({
              pathname: location.pathname,
              search: location.search || undefined,
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
          dispatch(
            playerActions.setAlbumMeta({
              albumId: currentAlbumId,
              album: album.album,
              artist: album.artist,
              fullName: album.fullName ?? `${album.artist} — ${album.album}`,
              cover: album.cover ?? null,
            })
          );
          dispatch(
            playerActions.setSourceLocation({
              pathname: location.pathname,
              search: location.search || undefined,
            })
          );
          // При обычном открытии (не восстановление) запускаем трек
          dispatch(playerActions.requestPlay());
        }
      }
    }
  }, [location.hash, location.pathname, location.search, album, dispatch, store]);

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
        savePlayerState(state);

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
      savePlayerState(initialState);

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
      dispatch(
        playerActions.setAlbumMeta({
          albumId,
          album: album.album,
          artist: album.artist,
          fullName: album.fullName ?? `${album.artist} — ${album.album}`,
          cover: album.cover ?? null,
        })
      );
      dispatch(
        playerActions.setSourceLocation({
          pathname: location.pathname,
          search: location.search || undefined,
        })
      );
      dispatch(playerActions.requestPlay());
    },
    [dispatch, album, location.pathname, location.search]
  );

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
          location={location}
          lang={lang}
          openPlayer={openPlayer}
          store={store}
        />
      </>
    );
  }

  // Если данных от лоадера ещё нет — отрисуем блок
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
};

// Мемоизируем компонент чтобы предотвратить перерендер при изменении состояния плеера
// Компонент перерендерится только если изменился проп album
export default React.memo(AlbumTracksComponent, (prevProps, nextProps) => {
  // Перерендериваем только если изменился альбом
  return prevProps.album.albumId === nextProps.album.albumId;
});
