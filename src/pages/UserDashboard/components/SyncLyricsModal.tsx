// src/pages/UserDashboard/components/SyncLyricsModal.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import type { SyncedLyricsLine } from '@/models';
import {
  saveSyncedLyrics,
  loadSyncedLyricsFromStorage,
  loadAuthorshipFromStorage,
} from '@features/syncedLyrics/lib';
import { loadTrackTextFromDatabase } from '@entities/track/lib';
import './SyncLyricsModal.style.scss';

interface SyncLyricsModalProps {
  isOpen: boolean;
  albumId: string;
  trackId: string;
  trackTitle: string;
  trackSrc?: string;
  lyricsText?: string;
  onClose: () => void;
}

// Форматирование времени для отображения (с миллисекундами для тайм-кодов)
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !Number.isFinite(seconds)) return '0:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

// Форматирование времени для отображения (MM:SS)
const formatTimeCompact = (seconds: number): string => {
  if (isNaN(seconds) || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function SyncLyricsModal({
  isOpen,
  albumId,
  trackId,
  trackTitle,
  trackSrc,
  lyricsText: propLyricsText,
  onClose,
}: SyncLyricsModalProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [syncedLines, setSyncedLines] = useState<SyncedLyricsLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Инициализация аудио элемента
  useEffect(() => {
    if (!trackSrc) return;

    const audio = new Audio(trackSrc);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [trackSrc]);

  // Загрузка данных при открытии модального окна
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      setIsDirty(false);
      setIsSaved(false);

      try {
        // Используем переданный текст или загружаем из БД
        const textToUse = propLyricsText || '';
        let linesToDisplay: SyncedLyricsLine[] = [];

        if (textToUse) {
          // Если есть текст, разбиваем на строки
          const contentLines = textToUse.split('\n').filter((line) => line.trim());

          // Пытаемся загрузить сохраненные синхронизации (необязательно)
          try {
            const storedSync = await loadSyncedLyricsFromStorage(albumId, trackId, lang);
            if (storedSync && storedSync.length > 0) {
              // Проверяем, совпадает ли текст с сохраненными синхронизациями
              const syncTextLines = storedSync
                .filter((line) => line.text) // Исключаем пустые строки
                .map((line) => line.text.trim());
              const currentTextLines = contentLines.map((line) => line.trim());

              // Если тексты совпадают, используем сохраненные синхронизации
              if (
                syncTextLines.length === currentTextLines.length &&
                syncTextLines.every((line, index) => line === currentTextLines[index])
              ) {
                linesToDisplay = storedSync;
              } else {
                // Текст изменился, создаем новые строки
                linesToDisplay = contentLines.map((line) => ({
                  text: line.trim(),
                  startTime: 0,
                  endTime: undefined,
                }));
              }
            } else {
              // Нет сохраненных синхронизаций, создаем новые строки
              linesToDisplay = contentLines.map((line) => ({
                text: line.trim(),
                startTime: 0,
                endTime: undefined,
              }));
            }
          } catch (syncError) {
            // Если не удалось загрузить синхронизации, просто используем текст
            console.warn('Не удалось загрузить синхронизации, используем новый текст:', syncError);
            linesToDisplay = contentLines.map((line) => ({
              text: line.trim(),
              startTime: 0,
              endTime: undefined,
            }));
          }
        } else {
          // Если нет текста, показываем пустое состояние
          linesToDisplay = [];
        }

        // Пытаемся загрузить авторство (необязательно, не блокируем если таймаут)
        try {
          const storedAuthorship = await Promise.race([
            loadAuthorshipFromStorage(albumId, trackId, lang),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);

          if (storedAuthorship) {
            const lastLine = linesToDisplay[linesToDisplay.length - 1];
            if (!lastLine || lastLine.text !== storedAuthorship) {
              linesToDisplay.push({
                text: storedAuthorship,
                startTime: duration || 0,
                endTime: undefined,
              });
            }
          }
        } catch (authorshipError) {
          // Игнорируем ошибки загрузки авторства
          console.warn('Не удалось загрузить авторство:', authorshipError);
        }

        setSyncedLines(linesToDisplay);
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        setSyncedLines([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, albumId, trackId, lang, propLyricsText, duration]);

  // Установить тайм-код для конкретной строки
  const setLineTime = useCallback(
    (lineIndex: number, field: 'startTime' | 'endTime') => {
      const time = currentTime;

      setSyncedLines((prev) => {
        const newLines = [...prev];
        if (!newLines[lineIndex]) return prev;

        newLines[lineIndex] = {
          ...newLines[lineIndex],
          [field]: time,
        };

        // Если устанавливаем startTime, автоматически устанавливаем/обновляем endTime предыдущей строки
        if (field === 'startTime' && lineIndex > 0) {
          const prevLine = newLines[lineIndex - 1];
          newLines[lineIndex - 1] = {
            ...prevLine,
            endTime: time,
          };
        }

        setIsDirty(true);
        return newLines;
      });
    },
    [currentTime]
  );

  // Сбросить endTime для конкретной строки
  const clearEndTime = useCallback((lineIndex: number) => {
    setSyncedLines((prev) => {
      const newLines = [...prev];
      if (!newLines[lineIndex]) return prev;

      const { endTime, ...rest } = newLines[lineIndex];
      newLines[lineIndex] = rest;

      setIsDirty(true);
      return newLines;
    });
  }, []);

  // Удалить строку
  const removeLine = useCallback((lineIndex: number) => {
    setSyncedLines((prev) => {
      const newLines = prev.filter((_, index) => index !== lineIndex);
      setIsDirty(true);
      return newLines;
    });
  }, []);

  // Сохранить синхронизации
  const handleSave = useCallback(async () => {
    if (syncedLines.length === 0) {
      alert('Нет строк для сохранения');
      return;
    }

    setIsSaving(true);

    try {
      // Загружаем авторство
      const storedAuthorship = await loadAuthorshipFromStorage(albumId, trackId, lang);
      const trackAuthorship = storedAuthorship || '';

      // Фильтруем строки авторства из syncedLines перед сохранением
      const linesToSave = syncedLines.filter((line, index) => {
        // Если это последняя строка и она совпадает с authorship, проверяем наличие таймкодов
        if (index === syncedLines.length - 1 && trackAuthorship && line.text === trackAuthorship) {
          return line.startTime > 0 || line.endTime !== undefined;
        }
        return true;
      });

      const result = await saveSyncedLyrics({
        albumId,
        trackId,
        lang,
        syncedLyrics: linesToSave,
        authorship: trackAuthorship.trim() || undefined,
      });

      if (result.success) {
        setIsDirty(false);
        setIsSaved(true);
        // Останавливаем воспроизведение и сбрасываем время
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
          setCurrentTime(0);
        }
      } else {
        alert(`❌ Ошибка сохранения: ${result.message || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      alert('❌ Ошибка сохранения синхронизаций');
    } finally {
      setIsSaving(false);
    }
  }, [albumId, trackId, lang, syncedLines]);

  // Переключение play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((error) => {
        console.error('Ошибка воспроизведения:', error);
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Обработка изменения прогресс-бара
  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioRef.current) return;
      const value = Number(e.target.value);
      const newTime = (value / 100) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      // Обновляем CSS переменную для визуального отображения прогресса
      const progressBar = e.target.parentElement;
      if (progressBar) {
        progressBar.style.setProperty('--progress-width', `${value}%`);
      }
    },
    [duration]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Обновляем CSS переменную для прогресс-бара
  useEffect(() => {
    const progressBar = document.querySelector('.sync-lyrics-modal__player-progress-bar');
    if (progressBar) {
      (progressBar as HTMLElement).style.setProperty('--progress-width', `${progress}%`);
    }
  }, [progress]);

  return (
    <Popup isActive={isOpen} onClose={onClose}>
      <div className="sync-lyrics-modal">
        <div className="sync-lyrics-modal__card">
          <div className="sync-lyrics-modal__header">
            <h2 className="sync-lyrics-modal__title">Синхронизация текста</h2>
            <button
              type="button"
              className="sync-lyrics-modal__close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <div className="sync-lyrics-modal__divider"></div>

          {/* Проигрыватель */}
          {trackSrc && (
            <div className="sync-lyrics-modal__player">
              <div className="sync-lyrics-modal__player-info">
                <div className="sync-lyrics-modal__player-title">{trackTitle}</div>
              </div>
              <div className="sync-lyrics-modal__player-controls">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="sync-lyrics-modal__player-play-btn"
                  aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
                >
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 3h2v10H5V3zm4 0h2v10H9V3z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 3l10 5-10 5V3z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="sync-lyrics-modal__player-progress-wrapper">
                <div className="sync-lyrics-modal__player-progress-bar">
                  <input
                    type="range"
                    value={progress}
                    min="0"
                    max="100"
                    onChange={handleProgressChange}
                    aria-label="Прогресс воспроизведения"
                  />
                </div>
                <div className="sync-lyrics-modal__player-time">
                  <span>{formatTimeCompact(currentTime)}</span>
                  <span>{formatTimeCompact(duration - currentTime)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Список строк с тайм-кодами */}
          <div className="sync-lyrics-modal__lines">
            {isLoading ? (
              <div className="sync-lyrics-modal__loading">Загрузка...</div>
            ) : syncedLines.length === 0 ? (
              <div className="sync-lyrics-modal__empty">
                {ui?.dashboard?.noLyrics ?? 'Нет текста для синхронизации'}
              </div>
            ) : (
              <div className="sync-lyrics-modal__lines-list">
                {syncedLines.map((line, index) => (
                  <div key={index} className="sync-lyrics-modal__line">
                    <div className="sync-lyrics-modal__line-number">{index + 1}</div>
                    <div className="sync-lyrics-modal__line-text">{line.text}</div>
                    <div className="sync-lyrics-modal__line-times">
                      <button
                        type="button"
                        onClick={() => setLineTime(index, 'startTime')}
                        className="sync-lyrics-modal__time-btn"
                        disabled={currentTime === 0 && !isPlaying}
                      >
                        {formatTime(line.startTime)}
                      </button>
                      <div className="sync-lyrics-modal__line-end">
                        <button
                          type="button"
                          onClick={() => setLineTime(index, 'endTime')}
                          className="sync-lyrics-modal__time-btn"
                          disabled={currentTime === 0 && !isPlaying}
                        >
                          {formatTime(line.endTime ?? 0)}
                        </button>
                        <button
                          type="button"
                          onClick={() => clearEndTime(index)}
                          className="sync-lyrics-modal__time-btn sync-lyrics-modal__time-btn--clear"
                          title="Сбросить конец строки"
                          disabled={line.endTime === undefined || line.endTime === 0}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="sync-lyrics-modal__line-remove"
                      aria-label="Удалить строку"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Кнопка сохранения */}
          {!isLoading && syncedLines.length > 0 && (
            <div className="sync-lyrics-modal__controls">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="sync-lyrics-modal__save-btn"
              >
                {isSaving ? 'Сохранение...' : 'Сохранить синхронизации'}
              </button>
              {isSaved && (
                <span className="sync-lyrics-modal__saved-indicator">Синхронизации сохранены</span>
              )}
              {isDirty && !isSaved && (
                <span className="sync-lyrics-modal__dirty-indicator">
                  Есть несохранённые изменения
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
}
