// src/pages/UserDashboard/components/PreviewLyricsModal.tsx
import React, { useState } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import './PreviewLyricsModal.style.scss';

interface PreviewLyricsModalProps {
  isOpen: boolean;
  lyrics: string;
  onClose: () => void;
}

// Mock данные для синхронизированных строк (пока статичные, потом подключим реальные)
const mockSyncedLyrics = [
  { text: 'Through the void of space', startTime: 0, endTime: 3 },
  { text: 'I soar', startTime: 3, endTime: 5 },
  { text: "Carried by stars' glow", startTime: 5, endTime: 8 },
  { text: 'so peculiar', startTime: 8, endTime: 10 },
  { text: "Finding what I've never", startTime: 10, endTime: 13 },
  { text: 'seen before', startTime: 13, endTime: 16 },
];

// Индекс выделенной строки (для демонстрации)
const HIGHLIGHTED_LINE_INDEX = 2; // "Carried by stars' glow so peculiar"

// Форматирование времени в формат MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function PreviewLyricsModal({ isOpen, lyrics, onClose }: PreviewLyricsModalProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [currentLineIndex, setCurrentLineIndex] = useState(HIGHLIGHTED_LINE_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(34); // 0:34 в секундах
  const [duration] = useState(238); // 3:58 в секундах

  const progress = duration > 0 ? currentTime / duration : 0;

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <Popup isActive={isOpen} onClose={onClose}>
      <div className="preview-lyrics-modal">
        <div className="preview-lyrics-modal__card">
          <div className="preview-lyrics-modal__header">
            <h2 className="preview-lyrics-modal__title">
              {ui?.dashboard?.previewLyrics ?? 'Preview Lyrics'}
            </h2>
            <button
              type="button"
              className="preview-lyrics-modal__close"
              onClick={onClose}
              aria-label={ui?.dashboard?.close ?? 'Close'}
            >
              ×
            </button>
          </div>
          <div className="preview-lyrics-modal__divider"></div>
          <div className="preview-lyrics-modal__player">
            <button
              type="button"
              className="preview-lyrics-modal__play-button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
            <div className="preview-lyrics-modal__time">{formatTime(currentTime)}</div>
            <div className="preview-lyrics-modal__progress-bar">
              <div
                className="preview-lyrics-modal__progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="preview-lyrics-modal__duration">{formatTime(duration)}</div>
          </div>
          <div className="preview-lyrics-modal__divider"></div>
          <div className="preview-lyrics-modal__content">
            <div className="preview-lyrics-modal__lyrics">
              {mockSyncedLyrics.map((line, index) => (
                <div
                  key={index}
                  className={`preview-lyrics-modal__lyric-line ${
                    index === currentLineIndex ? 'preview-lyrics-modal__lyric-line--active' : ''
                  }`}
                >
                  {line.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Popup>
  );
}
