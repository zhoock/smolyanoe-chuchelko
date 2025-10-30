// src/components/AudioPlayer/AudioPlayer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { AlbumCover } from '@entities/album';
import { IAlbums } from '../../models';
import { gaEvent } from '../../utils/ga';
import './style.scss';

export default function AudioPlayer({
  album,
  setBgColor,
  activeTrackIndex = 0,
  playRequestId,
  onTrackChange,
}: {
  album: IAlbums;
  activeTrackIndex?: number;
  playRequestId: number;
  onTrackChange?: (index: number) => void;
  setBgColor: (color: string) => void;
}) {
  const currentTrackIndex = Math.min(
    Math.max(activeTrackIndex ?? 0, 0),
    Math.max(album.tracks.length - 1, 0)
  );
  const [isPlaying, setIsPlaying] = useState(false); // флаг, указывающий, играет ли трек (изначально false)
  const [progress, setProgress] = useState(0); // прогресс трека в процентах (0-100)
  const [volume, setVolume] = useState(50); // уровень громкости (по умолчанию 50%)
  const [isSeeking, setIsSeeking] = useState(false); // указывает, выполняет ли пользователь перемотку
  const [time, setTime] = useState({ current: 0, duration: NaN }); // объект с текущим временем и общей длительностью трека
  const getAlbumId = (a: IAlbums) =>
    a.albumId ?? `${a.artist}-${a.album}`.toLowerCase().replace(/\s+/g, '-'); // уникальный ID альбома
  const startedKeyRef = useRef<string | null>(null); // хранит ключ события "started", чтобы не отправлять его несколько раз

  const audioRef = useRef<HTMLAudioElement | null>(null); // ссылка на элемент <audio>, чтобы управлять его состоянием (играет, ставится на паузу и т. д.)
  const latestTimeRef = useRef({ current: 0, duration: 1 }); // используется для хранения времени воспроизведения без вызова перерисовки компонента

  // Эффект для установки громкости
  useEffect(() => {
    if (audioRef.current) {
      console.log('Устанавливаем громкость:', volume);
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Эффект для смены трека
  useEffect(() => {
    if (audioRef.current) {
      console.log('Меняем трек:', album.tracks[currentTrackIndex]?.src);
      audioRef.current.src = album.tracks[currentTrackIndex]?.src || '';
      audioRef.current.load(); // загружаем новый трек ТОЛЬКО при смене трека

      startedKeyRef.current = null; // чтобы сбросить ключ события "started" при смене трека
    }
  }, [currentTrackIndex, album]);

  // Эффект для управления воспроизведением (играет/пауза)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(console.error);
    else el.pause();
  }, [isPlaying, currentTrackIndex]);

  // Стартуем воспроизведение по запросу извне
  useEffect(() => {
    if (!playRequestId) return;
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(console.error);
    setIsPlaying(true);
  }, [playRequestId, currentTrackIndex]);

  // Эффект для перехода к следующему треку после завершения текущего
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTrackEnd = () => {
      console.log('🎵 Трек завершён, переключаем на следующий');
      if (album.tracks.length === 0) return;
      const nextIndex = (currentTrackIndex + 1) % album.tracks.length;
      if (onTrackChange) {
        onTrackChange(nextIndex);
      } else if (audio) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      }
    };

    audio.addEventListener('ended', handleTrackEnd);

    return () => {
      audio.removeEventListener('ended', handleTrackEnd);
    };
  }, [album.tracks.length, currentTrackIndex, onTrackChange]);

  // Эффект для обновления времени и прогресса
  useEffect(() => {
    const el = audioRef.current; // зафиксировали ссылку
    if (!el) return;

    const updateProgress = () => {
      if (isSeeking) return;
      const current = el.currentTime;
      const duration = el.duration;
      if (isNaN(duration) || duration === 0) return;

      latestTimeRef.current = { current, duration };
      setTime({ current: latestTimeRef.current.current, duration: latestTimeRef.current.duration });

      const newProgress = (current / duration) * 100;
      setProgress(newProgress);

      const progressBar = document.querySelector(
        '.player__progress-bar input'
      ) as HTMLInputElement | null;
      if (progressBar) progressBar.style.setProperty('--progress-width', `${newProgress}%`);
    };

    const onMetadataLoaded = () => {
      setTime({ current: 0, duration: el.duration });
    };

    el.addEventListener('timeupdate', updateProgress);
    el.addEventListener('loadedmetadata', onMetadataLoaded);

    return () => {
      el.removeEventListener('timeupdate', updateProgress);
      el.removeEventListener('loadedmetadata', onMetadataLoaded);
    };
  }, [isSeeking, time.duration]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const albumId = getAlbumId(album);

    const onPlaying = () => {
      // ключ для "один раз на трек"
      const key = `${albumId}:${currentTrackIndex}`;
      if (startedKeyRef.current === key) return; // уже слали для этого трека

      const t = album.tracks[currentTrackIndex];
      gaEvent('audio_start', {
        album_id: albumId,
        album_title: album.album,
        track_id: t?.id ?? String(currentTrackIndex),
        track_title: t?.title ?? 'Unknown Track',
        position_seconds: Math.floor(el.currentTime), // обычно 0 в старт
      });

      startedKeyRef.current = key;
    };

    el.addEventListener('playing', onPlaying);
    return () => el.removeEventListener('playing', onPlaying);
  }, [album, currentTrackIndex]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const albumId = getAlbumId(album);

    const onPause = () => {
      const t = album.tracks[currentTrackIndex];
      gaEvent('audio_pause', {
        album_id: albumId,
        album_title: album.album,
        track_id: t?.id ?? String(currentTrackIndex),
        track_title: t?.title ?? 'Unknown Track',
        position_seconds: Math.floor(el.currentTime),
      });
    };

    el.addEventListener('pause', onPause);
    return () => el.removeEventListener('pause', onPause);
  }, [album, currentTrackIndex]);

  // Функция форматирования времени. Форматирует время 123 → "2:03".
  const formatTime = (time: number) => {
    if (isNaN(time)) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // ФУНКЦИИ УПРАВЛЕНИЯ

  // переключает воспроизведение/паузу
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        console.log('Пауза');
        audioRef.current.pause();
      } else {
        console.log('Воспроизведение');
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  // переключает на следующий трек
  const nextTrack = () => {
    if (!album.tracks.length) return;
    const nextIndex = (currentTrackIndex + 1) % album.tracks.length;
    onTrackChange?.(nextIndex);
  };

  // переключает на предыдущий
  const prevTrack = () => {
    if (!album.tracks.length) return;
    const prevIndex = (currentTrackIndex - 1 + album.tracks.length) % album.tracks.length;
    onTrackChange?.(prevIndex);
  };

  // Ползунок прогресса. Позволяет перематывать трек.
  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      setIsSeeking(true);
      const newTime = (Number(event.target.value) / 100) * time.duration;
      audioRef.current.currentTime = newTime;
      setTime((prev) => ({ ...prev, current: newTime }));
      setProgress(Number(event.target.value));

      event.target.style.setProperty('--progress-width', `${event.target.value}%`);
    }
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(event.target.value);
    setVolume(newVolume);

    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }

    event.target.style.setProperty('--volume-progress-width', `${newVolume}%`);
  };

  const handleColorsExtracted = useCallback(
    ({ dominant, palette }: { dominant: string; palette: string[] }) => {
      setBgColor(`linear-gradient(var(--rotate, 132deg), ${dominant}, ${palette[6] || dominant})`);
    },
    [setBgColor]
  );

  // Отображение
  return (
    <div className="player">
      <div
        className={clsx('player__cover', {
          'player__cover--playing': isPlaying,
          'player__cover--paused': !isPlaying,
        })}
      >
        <AlbumCover
          {...album.cover}
          fullName={album.fullName}
          onColorsExtracted={handleColorsExtracted}
        />
      </div>

      <div className="player__track-info">
        <h2>{album.tracks[currentTrackIndex]?.title || 'Unknown Track'}</h2>
        <h3>{album.artist || 'Unknown Artist'}</h3>
      </div>

      <div className="player__progress-container">
        <div className="player__progress-bar">
          <input
            type="range"
            value={progress}
            min="0"
            max="100"
            onChange={handleProgressChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
          />
        </div>
        <div className="player__time-container">
          <span className="player__time">{formatTime(time.current)}</span>
          <span className="player__time">-{formatTime(time.duration - time.current)}</span>
        </div>
      </div>

      <div className="player__controls">
        <button onClick={prevTrack}>
          <span className="icon-controller-fast-backward"></span>
        </button>
        <button onClick={togglePlayPause}>
          {isPlaying ? (
            <span className="icon-controller-pause"></span>
          ) : (
            <span className="icon-controller-play"></span>
          )}
        </button>
        <button onClick={nextTrack}>
          <span className="icon-controller-fast-forward"></span>
        </button>
      </div>

      <div className="player__volume-control">
        <span className="icon-volume-mute"></span>
        <input type="range" value={volume} min="0" max="100" onChange={handleVolumeChange} />
        <span className="icon-volume-hight"></span>
      </div>
      <audio ref={audioRef} />
    </div>
  );
}
