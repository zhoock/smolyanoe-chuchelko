import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../../models';

import './style.scss';

const tracks: Track[] = [
  {
    title: 'Фиджийская русалка Барнума',
    artist: 'Смоляное чучелко',
    src: '/audio/Barnums-Fijian-Mermaid.wav',
    cover: 'album-cover.jpg',
  },
  {
    title: 'Слипер',
    artist: 'Смоляное чучелко',
    src: '/audio/Sleeper.wav',
    cover: 'album-cover.jpg',
  },
  {
    title: 'Швайс',
    artist: 'Смоляное чучелко',
    src: '/audio/Schweiz.wav',
    cover: 'album-cover.jpg',
  },
];

const AudioPlayer: React.FC = () => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const loadTrack = (index: number) => {
    if (audioRef.current) {
      audioRef.current.src = tracks[index].src; // Устанавливаем новый источник
      audioRef.current.load(); // Загружаем новый трек
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Error playing the audio:', error);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    const newIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(newIndex);
    loadTrack(newIndex);

    // Даем браузеру время обработать загрузку и затем воспроизводим
    setTimeout(() => {
      if (isPlaying && audioRef.current) {
        audioRef.current.play().catch((error) => {
          console.error('Error playing the audio:', error);
        });
      }
    }, 100); // Задержка для разрешения на воспроизведение
  };

  const prevTrack = () => {
    const newIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(newIndex);
    loadTrack(newIndex);

    // Даем браузеру время обработать загрузку и затем воспроизводим
    setTimeout(() => {
      if (isPlaying && audioRef.current) {
        audioRef.current.play().catch((error) => {
          console.error('Error playing the audio:', error);
        });
      }
    }, 100); // Задержка для разрешения на воспроизведение
  };

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime =
        (Number(event.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
      setProgress(Number(event.target.value));
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  useEffect(() => {
    loadTrack(currentTrackIndex);
  }, [currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      const updateProgress = () => {
        if (audioRef.current) {
          const newProgress =
            (audioRef.current.currentTime / audioRef.current.duration) * 100 ||
            0;
          setProgress(newProgress);
        }
      };

      audioRef.current.addEventListener('timeupdate', updateProgress);
      return () => {
        audioRef.current?.removeEventListener('timeupdate', updateProgress);
      };
    }
  }, []);

  return (
    <div className="player">
      <div className="album-art">
        <img src={tracks[currentTrackIndex].cover} alt="Album Cover" />
      </div>
      <div className="track-info">
        <h2>{tracks[currentTrackIndex].title}</h2>
        <p>{tracks[currentTrackIndex].artist}</p>
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
};

export default AudioPlayer;
