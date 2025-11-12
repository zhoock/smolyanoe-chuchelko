function formatDuration(duration?: number): string {
  if (duration == null) return '';
  const [minutes, rawSeconds = '0'] = duration.toString().split('.');
  const normalizedSeconds =
    rawSeconds.length === 1 ? `${rawSeconds}0` : rawSeconds.slice(0, 2).padEnd(2, '0');
  return `${minutes}:${normalizedSeconds}`;
}
import React, { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import type { TracksProps, IAlbums } from '@models';
import { playerActions } from '@features/player';
import type { RootState } from '@app/providers/StoreProvider/config/store';
import { useStore } from 'react-redux';

type TrackListProps = {
  tracks: TracksProps[];
  album: IAlbums;
  lang: string;
  openPlayer: (index: number, options?: { openFullScreen?: boolean }) => void;
  onSelectTrack: (payload: {
    index: number;
    track: TracksProps;
    album: IAlbums;
    lang: string;
    isActive: boolean;
    isPlayingNow: boolean;
  }) => void;
  store: ReturnType<typeof useStore<RootState>>;
};

export function TrackList({
  tracks,
  album,
  lang,
  openPlayer,
  store,
  onSelectTrack,
}: TrackListProps) {
  const [activeIndex, setActiveIndex] = React.useState(store.getState().player.currentTrackIndex);
  const [isPlaying, setIsPlaying] = React.useState(store.getState().player.isPlaying);
  const [currentTrackId, setCurrentTrackId] = React.useState<string | number | null>(() => {
    const playerState = store.getState().player;
    return playerState.playlist[playerState.currentTrackIndex]?.id ?? null;
  });
  const [currentAlbumId, setCurrentAlbumId] = React.useState<string | null>(
    store.getState().player.albumId ?? null
  );

  const albumUniqueId = useMemo(
    () => album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-'),
    [album.albumId, album.artist, album.album]
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const playerState = store.getState().player;
      setActiveIndex(playerState.currentTrackIndex);
      setIsPlaying(playerState.isPlaying);
      setCurrentAlbumId(playerState.albumId ?? null);
      setCurrentTrackId(playerState.playlist[playerState.currentTrackIndex]?.id ?? null);
    });
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
            aria-description={
              isPlayingNow
                ? `Остановить воспроизведение: ${track.title}`
                : `Воспроизвести: ${track.title}`
            }
            onClick={() =>
              onSelectTrack({
                index,
                track,
                album,
                lang,
                isActive,
                isPlayingNow,
              })
            }
          >
            <span className="tracks__symbol">
              <span className="tracks__symbol-index">{index + 1}</span>
              <span className="tracks__symbol-play" aria-hidden>
                ▶
              </span>
              <span className="tracks__symbol-pause" aria-hidden>
                ❚❚
              </span>
              <span className="tracks__symbol-equalizer" aria-hidden>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
            <span className="tracks__title">{track.title}</span>
            <span className="tracks__duration">{formatDuration(track.duration)}</span>
          </button>
        );
      })}
    </div>
  );
}
