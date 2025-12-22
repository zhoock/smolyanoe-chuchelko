// src/pages/UserDashboard/components/SyncLyricsModal.tsx
import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
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
  authorship?: string; // Fallback для авторства, если не загрузилось из БД
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
        // Всегда загружаем текст из БД для актуальности данных
        const textToUse = await loadTrackTextFromDatabase(albumId, trackId, lang).catch((error) => {
          console.error('[SyncLyricsModal] Failed to load text from DB:', error);
          return '';
        });

        console.log('[SyncLyricsModal] Loaded text from DB:', {
          albumId,
          trackId,
          lang,
          textLength: textToUse?.length || 0,
          textPreview: textToUse?.substring(0, 50) || 'empty',
        });

        let linesToDisplay: SyncedLyricsLine[] = [];

        // Вспомогательная функция для создания строки с нулевыми таймкодами
        const createEmptyLine = (text: string): SyncedLyricsLine => ({
          text: text.trim(),
          startTime: 0,
          endTime: undefined,
        });

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

              // Фильтруем авторство из сохраненных синхронизаций
              const storedMain = storedSync.filter((line) => {
                const lineText = (line.text || '').trim();
                return !(trackAuthorship && lineText === trackAuthorship);
              });

              // Используем сохраненные синхронизации
              // Если количество строк совпадает - используем сохраненные синхронизации напрямую
              // (текст и таймкоды из БД - это источник истины)
              if (storedMain.length === contentLines.length) {
                // Количество строк совпадает - используем сохраненные синхронизации
                // но обновляем текст из БД (на случай если текст изменился)
                linesToDisplay = storedMain.map((storedLine, index) => {
                  const currentLine = contentLines[index];
                  return {
                    text: currentLine ? currentLine.trim() : storedLine.text.trim(),
                    startTime: storedLine.startTime,
                    endTime: storedLine.endTime,
                  };
                });
              } else {
                // Количество строк не совпадает - сопоставляем по тексту
                linesToDisplay = contentLines.map((currentLine) => {
                  // Ищем строку в сохраненных синхронизациях по тексту
                  const matchedLine = storedMain.find(
                    (stored) => stored.text.trim() === currentLine.trim()
                  );
                  if (matchedLine) {
                    return {
                      text: currentLine.trim(),
                      startTime: matchedLine.startTime,
                      endTime: matchedLine.endTime,
                    };
                  } else {
                    return createEmptyLine(currentLine);
                  }
                });
              }
            } else {
              // Нет сохраненных синхронизаций, создаем новые строки
              linesToDisplay = contentLines.map(createEmptyLine);
            }
          } catch (syncError) {
            // Если не удалось загрузить синхронизации, просто используем текст
            console.error('[SyncLyricsModal] Error loading synced lyrics:', syncError);
            linesToDisplay = contentLines.map(createEmptyLine);
          }
        } else {
          // Если нет текста, показываем пустое состояние
          linesToDisplay = [];
        }

        // Загружаем авторство и добавляем его в конец списка строк (для отображения)
        // При сохранении авторство будет отфильтровано из syncedLyrics и сохранено отдельным полем
        try {
          const storedAuthorship = await Promise.race([
            loadAuthorshipFromStorage(albumId, trackId, lang),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);

          const authorshipToUse = storedAuthorship || propAuthorship || null;

          // Добавляем авторство как последнюю строку (с таймкодом = duration или 0)
          if (authorshipToUse && authorshipToUse.trim()) {
            const lastLine = linesToDisplay[linesToDisplay.length - 1];
            // Проверяем, не добавлено ли авторство уже (чтобы не дублировать)
            if (!lastLine || lastLine.text.trim() !== authorshipToUse.trim()) {
              linesToDisplay.push({
                text: authorshipToUse.trim(),
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
  }, [isOpen, albumId, trackId, lang, duration]);

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
    (e: MouseEvent<HTMLDivElement>) => {
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
                  <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--clear"></div>
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
                          <button
                            type="button"
                            onClick={() => setLineTime(index, 'endTime')}
                            className="sync-lyrics-modal__time-btn"
                            disabled={currentTime === 0 && !isPlaying}
                          >
                            {formatTime(line.endTime)}
                          </button>
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
                      <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--clear">
                        {line.endTime !== undefined && line.endTime > 0 && (
                          <button
                            type="button"
                            onClick={() => clearEndTime(index)}
                            className="sync-lyrics-modal__clear-btn"
                            title="Сбросить конец строки"
                          >
                            ×
                          </button>
                        )}
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
