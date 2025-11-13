// src/features/player/ui/PlayerShell/PlayerShell.tsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from 'react-redux';
import type { IAlbums } from '@models';

import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { playerActions } from '@features/player/model/slice/playerSlice';
import * as playerSelectors from '@features/player/model/selectors/playerSelectors';
import { audioController } from '@features/player/model/lib/audioController';
import { MiniPlayer } from './MiniPlayer';
import AudioPlayer from '@features/player/ui/AudioPlayer/AudioPlayer';
import type { RootState } from '@app/providers/StoreProvider/config/store';
import { loadPlayerState, savePlayerState } from '@features/player/model/lib/playerPersist';

const DEFAULT_BG = 'rgba(var(--extra-background-color-rgb) / 80%)';
const DEFAULT_BOTTOM_OFFSET = 24;

export const PlayerShell: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const store = useStore<RootState>();

  const albumMeta = useAppSelector(playerSelectors.selectAlbumMeta);
  const playlist = useAppSelector(playerSelectors.selectPlaylist);
  const currentTrack = useAppSelector(playerSelectors.selectCurrentTrack);
  const isPlaying = useAppSelector(playerSelectors.selectIsPlaying);
  const time = useAppSelector(playerSelectors.selectTime);
  const isSeeking = useAppSelector(playerSelectors.selectIsSeeking);
  const hasPlaylist = useAppSelector(playerSelectors.selectHasPlaylist);
  const sourceLocation = useAppSelector(playerSelectors.selectSourceLocation);

  const [bgColor, setBgColor] = useState<string>(DEFAULT_BG);
  const [miniBottomOffset, setMiniBottomOffset] = useState<number>(DEFAULT_BOTTOM_OFFSET);

  const isFullScreen = location.hash === '#player';
  const shouldRenderMini = hasPlaylist && !!albumMeta && !!currentTrack && !isFullScreen;

  const miniPlayerRef = useRef<HTMLDivElement | null>(null);
  const rewindIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartTimeRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const wasRewindingRef = useRef(false);
  const hasLongPressTimerRef = useRef(false);
  const shouldBlockTrackSwitchRef = useRef(false);
  const timeRef = useRef(time);
  const isSeekingRef = useRef(isSeeking);
  const seekProtectionUntilRef = useRef<number>(0);
  const hasHydratedFromStorageRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let lastSerialized = '';
    let lastSavedAt = 0;
    const unsubscribe = store.subscribe(() => {
      const playerState = store.getState().player;
      if (!playerState || playerState.playlist.length === 0 || !playerState.albumMeta?.albumId) {
        return;
      }

      const serializedCandidate = JSON.stringify({
        albumId: playerState.albumId,
        currentTrackIndex: playerState.currentTrackIndex,
        playlistLength: playerState.playlist.length,
        timeCurrent: Math.floor(playerState.time.current),
        timeDuration: Math.floor(
          Number.isFinite(playerState.time.duration) ? playerState.time.duration : 0
        ),
        volume: playerState.volume,
        isPlaying: playerState.isPlaying,
      });

      const now = Date.now();
      if (serializedCandidate !== lastSerialized || now - lastSavedAt > 1000) {
        lastSerialized = serializedCandidate;
        lastSavedAt = now;
        savePlayerState(playerState);
      }
    });

    return unsubscribe;
  }, [store]);

  useEffect(() => {
    if (hasHydratedFromStorageRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (location.hash !== '#player') {
      return;
    }

    const currentState = store.getState().player;
    if (
      currentState.playlist.length > 0 &&
      currentState.albumMeta &&
      currentState.albumMeta.albumId
    ) {
      hasHydratedFromStorageRef.current = true;
      return;
    }

    const savedState = loadPlayerState();
    if (!savedState || !Array.isArray(savedState.playlist) || savedState.playlist.length === 0) {
      hasHydratedFromStorageRef.current = true;
      return;
    }

    const playlist = savedState.playlist;
    const originalPlaylist =
      Array.isArray(savedState.originalPlaylist) && savedState.originalPlaylist.length > 0
        ? savedState.originalPlaylist
        : playlist;
    const safeIndex = Math.max(0, Math.min(savedState.currentTrackIndex ?? 0, playlist.length - 1));

    hasHydratedFromStorageRef.current = true;

    const fallbackSourceLocation = {
      pathname: location.pathname,
      search: location.search || undefined,
    };

    const playbackTime = savedState.time ?? { current: 0, duration: NaN };

    dispatch(
      playerActions.hydrateFromPersistedState({
        playlist,
        originalPlaylist,
        currentTrackIndex: safeIndex,
        albumId: savedState.albumId ?? null,
        albumTitle:
          savedState.albumTitle ??
          savedState.albumMeta?.album ??
          savedState.albumMeta?.fullName ??
          null,
        albumMeta: savedState.albumMeta ?? null,
        sourceLocation: savedState.sourceLocation ?? fallbackSourceLocation,
        volume: savedState.volume ?? 50,
        isPlaying: savedState.isPlaying ?? false,
        shuffle: savedState.shuffle ?? false,
        repeat: savedState.repeat ?? 'none',
        time: playbackTime,
        showLyrics: savedState.showLyrics ?? false,
        controlsVisible: savedState.controlsVisible ?? true,
      })
    );

    audioController.setVolume(savedState.volume ?? 50);
    audioController.setSource(playlist[safeIndex]?.src, savedState.isPlaying ?? false);
    audioController.setCurrentTime(playbackTime.current ?? 0);

    if (savedState.isPlaying) {
      dispatch(playerActions.play());
    } else {
      dispatch(playerActions.pause());
    }
  }, [dispatch, location.hash, location.pathname, location.search, store]);

  useEffect(() => {
    if (albumMeta) {
      setBgColor(DEFAULT_BG);
    }
  }, [albumMeta]);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  const updateMiniPlayerPosition = useCallback(() => {
    const playerEl = miniPlayerRef.current;
    const footerEl = document.querySelector('footer');

    if (!playerEl || !footerEl) {
      setMiniBottomOffset(DEFAULT_BOTTOM_OFFSET);
      return;
    }

    const footerRect = footerEl.getBoundingClientRect();
    const overlap = window.innerHeight - DEFAULT_BOTTOM_OFFSET - footerRect.top;
    const extraOffset =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ms-0')) || 0;
    const nextOffset = DEFAULT_BOTTOM_OFFSET + Math.max(0, overlap + extraOffset);

    setMiniBottomOffset((prev) => {
      if (Math.abs(prev - nextOffset) > 1) {
        return nextOffset;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!shouldRenderMini) {
      setMiniBottomOffset(DEFAULT_BOTTOM_OFFSET);
      return;
    }

    const handle = () => {
      updateMiniPlayerPosition();
    };

    handle();

    window.addEventListener('scroll', handle, { passive: true });
    window.addEventListener('resize', handle);

    return () => {
      window.removeEventListener('scroll', handle);
      window.removeEventListener('resize', handle);
    };
  }, [shouldRenderMini, updateMiniPlayerPosition]);

  useLayoutEffect(() => {
    if (!shouldRenderMini) {
      return;
    }

    setMiniBottomOffset(DEFAULT_BOTTOM_OFFSET);
    let frameId = 0;
    let secondFrameId = 0;
    frameId = requestAnimationFrame(() => {
      secondFrameId = requestAnimationFrame(() => {
        updateMiniPlayerPosition();
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(secondFrameId);
    };
  }, [location.pathname, location.search, updateMiniPlayerPosition, shouldRenderMini]);

  const albumForPlayer = useMemo<IAlbums | null>(() => {
    if (!albumMeta) {
      return null;
    }

    const cover =
      albumMeta.cover ??
      ({
        img: '',
        fullName: albumMeta.fullName ?? albumMeta.album ?? '',
      } as IAlbums['cover']);

    return {
      albumId: albumMeta.albumId ?? undefined,
      artist: albumMeta.artist ?? '',
      album: albumMeta.album ?? '',
      fullName:
        albumMeta.fullName ||
        (albumMeta.artist && albumMeta.album ? `${albumMeta.artist} — ${albumMeta.album}` : ''),
      description: '',
      cover,
      release: {},
      buttons: {},
      details: [],
      tracks: playlist,
    };
  }, [albumMeta, playlist]);

  const canRenderPopup = !!albumForPlayer;

  const handleToggle = useCallback(() => {
    dispatch(playerActions.toggle());
  }, [dispatch]);

  const handleNext = useCallback(() => {
    dispatch(playerActions.nextTrack(playlist.length));
  }, [dispatch, playlist.length]);

  const handleFastForwardStart = useCallback(() => {
    const startTime = Date.now();
    pressStartTimeRef.current = startTime;
    isLongPressRef.current = false;
    wasRewindingRef.current = false;
    hasLongPressTimerRef.current = false;
    shouldBlockTrackSwitchRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    hasLongPressTimerRef.current = true;

    longPressTimerRef.current = setTimeout(() => {
      if (pressStartTimeRef.current === startTime) {
        isLongPressRef.current = true;
        wasRewindingRef.current = true;
        shouldBlockTrackSwitchRef.current = true;
        isSeekingRef.current = true;
        seekProtectionUntilRef.current = Date.now() + 2000;
        const step = 5;

        rewindIntervalRef.current = setInterval(() => {
          const currentTime = timeRef.current.current || 0;
          const duration = timeRef.current.duration || 0;
          let newTime = currentTime + step;

          newTime = Math.max(0, Math.min(duration, newTime));
          const progress = duration > 0 ? (newTime / duration) * 100 : 0;

          dispatch(playerActions.setSeeking(true));
          seekProtectionUntilRef.current = Date.now() + 2000;
          dispatch(playerActions.setCurrentTime(newTime));
          dispatch(playerActions.setTime({ current: newTime, duration }));
          dispatch(playerActions.setProgress(progress));
          audioController.setCurrentTime(newTime);
        }, 200);
      }
    }, 200);
  }, [dispatch]);

  const handleFastForwardEnd = useCallback(() => {
    const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;
    const isRewindingActive = shouldBlockTrackSwitchRef.current;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (rewindIntervalRef.current) {
      clearInterval(rewindIntervalRef.current);
      rewindIntervalRef.current = null;
      dispatch(playerActions.setSeeking(false));
      isSeekingRef.current = false;
      seekProtectionUntilRef.current = Date.now() + 1500;
      if (isPlaying) {
        dispatch(playerActions.play());
      }
    }

    if (isRewindingActive) {
      setTimeout(() => {
        pressStartTimeRef.current = null;
        isLongPressRef.current = false;
        hasLongPressTimerRef.current = false;
        wasRewindingRef.current = false;
        setTimeout(() => {
          shouldBlockTrackSwitchRef.current = false;
        }, 300);
      }, 150);
      return;
    }

    if (pressDuration > 0 && pressDuration < 150) {
      handleNext();
    }

    setTimeout(() => {
      pressStartTimeRef.current = null;
      isLongPressRef.current = false;
      hasLongPressTimerRef.current = false;
      wasRewindingRef.current = false;
    }, 150);
  }, [dispatch, handleNext, isPlaying]);

  const forwardHandlers = useMemo(
    () => ({
      onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        handleFastForwardStart();
      },
      onMouseUp: () => {
        handleFastForwardEnd();
      },
      onMouseLeave: () => {
        handleFastForwardEnd();
      },
      onTouchStart: (event: React.TouchEvent<HTMLButtonElement>) => {
        event.preventDefault();
        handleFastForwardStart();
      },
      onTouchEnd: (event: React.TouchEvent<HTMLButtonElement>) => {
        event.preventDefault();
        handleFastForwardEnd();
      },
    }),
    [handleFastForwardStart, handleFastForwardEnd]
  );

  const handleExpand = useCallback(() => {
    const currentLocation = {
      pathname: location.pathname,
      search: location.search || undefined,
    };

    dispatch(playerActions.setSourceLocation(currentLocation));

    navigate(
      {
        pathname: currentLocation.pathname,
        search: currentLocation.search,
        hash: '#player',
      },
      { replace: false }
    );
  }, [dispatch, navigate, location.pathname, location.search]);

  const handleClose = useCallback(() => {
    // Используем sourceLocation для возврата на исходную страницу
    // Если sourceLocation установлен, возвращаемся на него
    // Иначе используем navigate(-1) как fallback
    if (sourceLocation) {
      navigate(
        {
          pathname: sourceLocation.pathname,
          search: sourceLocation.search,
        },
        { replace: true }
      );
    } else {
      // Fallback: возвращаемся назад в истории браузера
      navigate(-1);
    }
  }, [navigate, sourceLocation]);

  useEffect(() => {
    if ((!albumMeta || playlist.length === 0) && isPlaying) {
      dispatch(playerActions.pause());
    }
  }, [albumMeta, playlist.length, dispatch, isPlaying]);

  useEffect(() => {
    return () => {
      if (rewindIntervalRef.current) {
        clearInterval(rewindIntervalRef.current);
        rewindIntervalRef.current = null;
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, []);

  if (!albumMeta || playlist.length === 0) {
    return null;
  }

  return (
    <>
      {shouldRenderMini && currentTrack && (
        <MiniPlayer
          title={currentTrack.title}
          cover={albumMeta.cover}
          isPlaying={isPlaying}
          onToggle={handleToggle}
          onExpand={handleExpand}
          forwardHandlers={forwardHandlers}
          bottomOffset={miniBottomOffset}
          containerRef={miniPlayerRef}
        />
      )}

      {canRenderPopup && albumForPlayer && (
        <Popup isActive={isFullScreen} bgColor={bgColor} onClose={handleClose}>
          <Hamburger isActive onToggle={handleClose} />
          <AudioPlayer album={albumForPlayer} setBgColor={setBgColor} />
        </Popup>
      )}
    </>
  );
};
