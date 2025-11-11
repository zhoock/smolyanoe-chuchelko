// src/features/player/ui/PlayerShell/MiniPlayer.tsx
import React from 'react';
import clsx from 'clsx';
import type { CoverProps } from 'models';
import AlbumCover from '@entities/album/ui/AlbumCover';

import './style.scss';

interface ForwardHandlers {
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (event: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLButtonElement>) => void;
}

interface MiniPlayerProps {
  title: string;
  cover?: CoverProps | null;
  isPlaying: boolean;
  onToggle: () => void;
  onExpand: () => void;
  forwardHandlers: ForwardHandlers;
  bottomOffset: number;
  containerRef?: React.Ref<HTMLDivElement>;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  title,
  cover,
  isPlaying,
  onToggle,
  onExpand,
  forwardHandlers,
  bottomOffset,
  containerRef,
}) => {
  return (
    <div
      ref={containerRef}
      className="mini-player"
      role="button"
      tabIndex={0}
      aria-label="Открыть полноэкранный плеер"
      onClick={onExpand}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onExpand();
        }
      }}
      style={
        {
          '--mini-player-bottom': `${bottomOffset}px`,
        } as React.CSSProperties
      }
    >
      <div className="mini-player__cover">
        {cover ? (
          <AlbumCover {...cover} size={64} densities={[1, 2]} sizes="64px" />
        ) : (
          <div className="mini-player__cover-placeholder" aria-hidden />
        )}
      </div>

      <div className="mini-player__title" title={title}>
        {title}
      </div>

      <div className="mini-player__controls" aria-label="Управление воспроизведением">
        <button
          type="button"
          className={clsx(
            'mini-player__control',
            isPlaying ? 'icon-controller-pause' : 'icon-controller-play'
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
        />
        <button
          type="button"
          className="mini-player__control icon-controller-fast-forward"
          onMouseDown={(event) => {
            event.stopPropagation();
            forwardHandlers.onMouseDown(event);
          }}
          onMouseUp={(event) => {
            event.stopPropagation();
            forwardHandlers.onMouseUp();
          }}
          onMouseLeave={(event) => {
            event.stopPropagation();
            forwardHandlers.onMouseLeave();
          }}
          onTouchStart={(event) => {
            event.stopPropagation();
            forwardHandlers.onTouchStart(event);
          }}
          onTouchEnd={(event) => {
            event.stopPropagation();
            forwardHandlers.onTouchEnd(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label="Следующий трек"
        />
      </div>
    </div>
  );
};
