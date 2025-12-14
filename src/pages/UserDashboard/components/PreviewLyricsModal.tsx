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
  syncedLyrics?: { text: string; startTime: number; endTime?: number }[];
  authorship?: string;
  onClose: () => void;
}

// Форматирование времени в формат MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function PreviewLyricsModal({
  isOpen,
  lyrics,
  syncedLyrics,
  authorship,
  onClose,
}: PreviewLyricsModalProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime] = useState(0);
  const [duration] = useState(0);

  // Берём синхронизированный текст, если есть; иначе разбиваем lyrics по строкам
  const lines =
    syncedLyrics && syncedLyrics.length > 0
      ? syncedLyrics
      : lyrics
          .split('\n')
          .filter((l) => l.trim().length > 0)
          .map((text) => ({ text, startTime: 0 }));

  // Добавляем авторство как последнюю строку (без тайм-кода), если есть
  const linesWithAuthorship =
    authorship && authorship.trim() ? [...lines, { text: authorship.trim(), startTime: 0 }] : lines;

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
              {linesWithAuthorship.map((line, index) => (
                <div key={index} className="preview-lyrics-modal__lyric-line">
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
