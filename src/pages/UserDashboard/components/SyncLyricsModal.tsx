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
  clearSyncedLyricsCache,
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
  authorship?: string;
  onClose: () => void;
  onSave?: () => void;
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
  authorship: propAuthorship,
  onClose,
  onSave,
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

          // Пытаемся загрузить сохраненные синхронизации из БД (необязательно)
          // Очищаем кэш перед загрузкой, чтобы получить актуальные данные
          clearSyncedLyricsCache(albumId, trackId, lang);
          try {
            const storedSync = await loadSyncedLyricsFromStorage(albumId, trackId, lang);
            if (storedSync && storedSync.length > 0) {
              // Загружаем авторство для фильтрации
              const storedAuthorship = await loadAuthorshipFromStorage(
                albumId,
                trackId,
                lang
              ).catch(() => null);
              const trackAuthorship = (storedAuthorship || propAuthorship || '').trim();

              // Фильтруем авторство из сохраненных синхронизаций при сравнении
              // Сравниваем только первые N строк (без авторства)
              const storedMain = storedSync.filter((line) => {
                const lineText = (line.text || '').trim();
                return !(trackAuthorship && lineText === trackAuthorship);
              });

              // Проверяем, совпадает ли текст с сохраненными синхронизациями
              const syncTextLines = storedMain
                .filter((line) => line.text) // Исключаем пустые строки
                .map((line) => line.text.trim());
              const currentTextLines = contentLines.map((line) => line.trim());

              // Если тексты совпадают, используем сохраненные синхронизации (без авторства)
              if (
                syncTextLines.length === currentTextLines.length &&
                syncTextLines.every((line, index) => line === currentTextLines[index])
              ) {
                linesToDisplay = storedMain;
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
        // Авторство НЕ добавляется в linesToDisplay
        // Оно хранится отдельным полем authorship в БД
        // В UI авторство показывается отдельно, не как часть синхронизированных строк
        try {
          const storedAuthorship = await Promise.race([
            loadAuthorshipFromStorage(albumId, trackId, lang),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);

          // Авторство используется только для отображения в UI, но не добавляется в syncedLyrics
          const authorshipToUse = storedAuthorship || propAuthorship || null;
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
      const trackAuthorship = (storedAuthorship || propAuthorship || '').trim();

      // Фильтруем строки авторства из syncedLines перед сохранением
      // Авторство хранится отдельным полем authorship, не должно быть в syncedLyrics
      const linesToSave = syncedLines.filter((line) => {
        const lineText = (line.text || '').trim();
        // Исключаем строки, которые совпадают с авторством
        return !(trackAuthorship && lineText === trackAuthorship);
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
        // Очищаем кэш синхронизаций, чтобы при следующей загрузке получить актуальные данные
        clearSyncedLyricsCache(albumId, trackId, lang);
        // Останавливаем воспроизведение и сбрасываем время
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
          setCurrentTime(0);
        }
        // Вызываем callback для обновления статуса трека
        if (onSave) {
          onSave();
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
  }, [albumId, trackId, lang, syncedLines, propAuthorship, onSave]);

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

  // Обработка клика по прогресс-бару
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
          <div className="sync-lyrics-modal__player">
            <button
              type="button"
              onClick={togglePlayPause}
              className="sync-lyrics-modal__play-button"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
              disabled={!trackSrc}
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
            <div className="sync-lyrics-modal__time">{formatTimeCompact(currentTime)}</div>
            <div className="sync-lyrics-modal__progress-bar" onClick={handleProgressClick}>
              <div className="sync-lyrics-modal__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="sync-lyrics-modal__duration">{formatTimeCompact(duration)}</div>
          </div>

          <div className="sync-lyrics-modal__divider"></div>

          {/* Таблица строк с тайм-кодами */}
          <div className="sync-lyrics-modal__content">
            {isLoading ? (
              <div className="sync-lyrics-modal__loading">Загрузка...</div>
            ) : syncedLines.length === 0 ? (
              <div className="sync-lyrics-modal__empty">
                {ui?.dashboard?.noLyrics ?? 'Нет текста для синхронизации'}
              </div>
            ) : (
              <div className="sync-lyrics-modal__table">
                <div className="sync-lyrics-modal__table-header">
                  <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--number">
                    #
                  </div>
                  <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--lyrics">
                    Lyrics
                  </div>
                  <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--start">
                    Start
                  </div>
                  <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--end">
                    End
                  </div>
                  <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--remove"></div>
                </div>
                <div className="sync-lyrics-modal__table-body">
                  {syncedLines.map((line, index) => (
                    <div key={index} className="sync-lyrics-modal__table-row">
                      <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--number">
                        {index + 1}
                      </div>
                      <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--lyrics">
                        {line.text}
                      </div>
                      <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--start">
                        <button
                          type="button"
                          onClick={() => setLineTime(index, 'startTime')}
                          className="sync-lyrics-modal__time-btn"
                          disabled={currentTime === 0 && !isPlaying}
                        >
                          {formatTime(line.startTime)}
                        </button>
                      </div>
                      <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--end">
                        {line.endTime !== undefined && line.endTime > 0 ? (
                          <div className="sync-lyrics-modal__end-time-wrapper">
                            <button
                              type="button"
                              onClick={() => setLineTime(index, 'endTime')}
                              className="sync-lyrics-modal__time-btn"
                              disabled={currentTime === 0 && !isPlaying}
                            >
                              {formatTime(line.endTime)}
                            </button>
                            <button
                              type="button"
                              onClick={() => clearEndTime(index)}
                              className="sync-lyrics-modal__clear-btn"
                              title="Сбросить конец строки"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLineTime(index, 'endTime')}
                            className="sync-lyrics-modal__time-btn sync-lyrics-modal__time-btn--set"
                            disabled={currentTime === 0 && !isPlaying}
                          >
                            Set end
                          </button>
                        )}
                      </div>
                      <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--remove">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="sync-lyrics-modal__remove-btn"
                          aria-label="Удалить строку"
                          title="Удалить строку"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Кнопки действий */}
          {!isLoading && syncedLines.length > 0 && (
            <>
              <div className="sync-lyrics-modal__divider"></div>
              <div className="sync-lyrics-modal__actions">
                <button
                  type="button"
                  className="sync-lyrics-modal__button sync-lyrics-modal__button--cancel"
                  onClick={onClose}
                >
                  {ui?.dashboard?.cancel ?? 'Cancel'}
                </button>
                <div className="sync-lyrics-modal__actions-right">
                  {isSaved && (
                    <span className="sync-lyrics-modal__saved-indicator">
                      Синхронизации сохранены
                    </span>
                  )}
                  {isDirty && !isSaved && (
                    <span className="sync-lyrics-modal__dirty-indicator">
                      Есть несохранённые изменения
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="sync-lyrics-modal__button sync-lyrics-modal__button--primary"
                  >
                    {isSaving ? 'Saving...' : 'Save Sync'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Popup>
  );
}
