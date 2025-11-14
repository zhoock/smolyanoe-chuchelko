import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from 'react-redux';
import type { RootState } from '@shared/model/appStore/types';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, loadPlayerState, savePlayerState } from '@features/player';
import type { IAlbums, TracksProps } from '@models';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import { gaEvent } from '@shared/lib/analytics';
import { TrackList } from '@entities/track/ui/TrackList';
import './style.scss';

/**
 * Компонент отображает список треков и управляет аудиоплеером.
 * Клик по треку запускает воспроизведение, меню открывает текст песни.
 */
const AlbumTracksComponent = ({ album }: { album: IAlbums }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const activeIndexRef = useRef(0);
  const playlistLengthRef = useRef(0);

  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const location = useLocation();
  const navigate = useNavigate();

  // UI словарь загружается через loader

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const state = store.getState().player;
      activeIndexRef.current = state.currentTrackIndex;
    });
    activeIndexRef.current = store.getState().player.currentTrackIndex;
    return unsubscribe;
  }, [store]);

  useEffect(() => {
    playlistLengthRef.current = store.getState().player.playlist.length;
  }, [store]);

  useEffect(() => {
    const shouldBeOpen = location.hash === '#player';
    const playlistLength = store.getState().player.playlist.length;
    if (shouldBeOpen && playlistLength === 0 && album && album.tracks && album.tracks.length > 0) {
      const savedState = loadPlayerState();
      const currentAlbumId =
        album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');
      const currentState = store.getState().player;

      if (currentState.playlist.length === 0) {
        if (savedState && savedState.albumId === currentAlbumId) {
          const validTrackIndex = Math.max(
            0,
            Math.min(savedState.currentTrackIndex, album.tracks.length - 1)
          );

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
          dispatch(playerActions.pause());
        } else {
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
          dispatch(playerActions.requestPlay());
        }
      }
    }
  }, [location.hash, location.pathname, location.search, album, dispatch, store]);

  useEffect(() => {
    let lastSavedState = {
      albumId: store.getState().player.albumId,
      currentTrackIndex: store.getState().player.currentTrackIndex,
      playlistLength: store.getState().player.playlist.length,
    };

    const unsubscribe = store.subscribe(() => {
      const state = store.getState().player;

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

    const initialState = store.getState().player;
    if (initialState.albumId && initialState.playlist.length > 0) {
      savePlayerState(initialState);
    }

    return unsubscribe;
  }, [store]);

  const openPlayer = useCallback(
    (trackIndex: number, options?: { openFullScreen?: boolean }) => {
      const albumId =
        album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');
      const playlist = album.tracks || [];
      const selectedTrack = playlist[trackIndex];

      dispatch(playerActions.setPlaylist(playlist));

      if (selectedTrack) {
        const currentState = store.getState().player;
        const actualPlaylist = currentState.playlist;
        const actualIndex = actualPlaylist.findIndex((track) => track.id === selectedTrack.id);
        if (actualIndex !== -1) {
          dispatch(playerActions.setCurrentTrackIndex(actualIndex));
        } else {
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

      if (options?.openFullScreen !== false) {
        navigate(
          {
            pathname: location.pathname,
            search: location.search || undefined,
            hash: '#player',
          },
          { replace: false }
        );
      }
    },
    [dispatch, album, location.pathname, location.search, navigate, store]
  );

  const handleTrackSelect = useCallback(
    ({
      index,
      track,
      isActive,
      isPlayingNow,
    }: {
      index: number;
      track: TracksProps;
      isActive: boolean;
      isPlayingNow: boolean;
    }) => {
      if (isActive) {
        if (isPlayingNow) {
          store.dispatch(playerActions.pause());
        } else {
          store.dispatch(playerActions.play());
        }
        return;
      }

      gaEvent('track_select', {
        album_id: album?.albumId,
        album_title: album?.album,
        track_id: track.id,
        track_title: track.title,
        lang,
      });

      openPlayer(index, { openFullScreen: false });
    },
    [album, lang, openPlayer, store]
  );

  const renderBlock = useCallback(
    ({ tracks, playText = 'Play' }: { tracks: TracksProps[]; playText?: string }) => {
      const albumHeader = (
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
                openPlayer(0, { openFullScreen: false });
              }}
            >
              <span className="icon-controller-play"></span>
              {playText}
            </button>
          </div>
        </>
      );

      return (
        <>
          {albumHeader}
          <TrackList
            tracks={tracks}
            album={album}
            onSelectTrack={handleTrackSelect}
            store={store}
          />
        </>
      );
    },
    [album, lang, openPlayer, handleTrackSelect, store]
  );

  const playText = ui?.buttons?.playButton ?? 'Play';
  return renderBlock({ tracks: album?.tracks || [], playText });
};

export default React.memo(AlbumTracksComponent, (prevProps, nextProps) => {
  return prevProps.album.albumId === nextProps.album.albumId;
});
