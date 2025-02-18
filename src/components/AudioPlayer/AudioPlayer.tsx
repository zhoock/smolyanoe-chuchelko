import React, { useState, useRef, useEffect } from 'react';
import { IAlbums } from '../../models';
import './style.scss';

export default function AudioPlayer({ album }: { album: IAlbums }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadTrack = (index: number) => {
    if (audioRef.current) {
      audioRef.current.src = album.tracks[index]?.src || '';
      audioRef.current.load();
      audioRef.current.play().catch(console.error); // Упростил обработку ошибок
      setIsPlaying(true); // Сразу обновляем состояние кнопки
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    loadTrack(currentTrackIndex); // Загружаем трек сразу при изменении индекса

    const updateProgress = () => {
      if (audioRef.current) {
        const newProgress =
          (audioRef.current.currentTime / audioRef.current.duration) * 100 || 0;
        setProgress(newProgress);
      }
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('timeupdate', updateProgress);
      return () =>
        audioRef.current?.removeEventListener('timeupdate', updateProgress);
    }
  }, [currentTrackIndex, album, volume]); // Следим за изменениями всех этих зависимостей

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    setCurrentTrackIndex((currentTrackIndex + 1) % album.tracks.length);
  };

  const prevTrack = () => {
    setCurrentTrackIndex(
      (currentTrackIndex - 1 + album.tracks.length) % album.tracks.length,
    );
  };

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime =
        (Number(event.target.value) / 100) * audioRef.current.duration;
      setProgress(Number(event.target.value));
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  return (
    <div className="player">
      <div className="album-art">
        <img src={album.cover.img || ''} alt="Album Cover" />
      </div>
      <div className="track-info">
        <h2>{album.tracks[currentTrackIndex]?.title || 'Unknown Track'}</h2>
        <p>{album.nameGroup || 'Unknown Artist'}</p>
      </div>
      <div className="controls">
        <button onClick={prevTrack}>⏮️</button>
        <button onClick={togglePlayPause}>{isPlaying ? '⏸️' : '▶️'}</button>
        <button onClick={nextTrack}>⏭️</button>
      </div>
      <div className="progress-bar">
        <input
          type="range"
          value={progress}
          min="0"
          max="100"
          onChange={handleProgressChange}
        />
      </div>
      <div className="volume-control">
        <input
          type="range"
          value={volume}
          min="0"
          max="100"
          onChange={handleVolumeChange}
        />
      </div>
      <audio ref={audioRef} />
    </div>
  );
}
