// src/pages/UserDashboard/components/SyncLyricsModal.tsx
import { useState, useEffect, useCallback, useRef, useLayoutEffect, type MouseEvent } from 'react';
import { Popup } from '@shared/ui/popup';
import { AlertModal } from '@shared/ui/alertModal';
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
  authorship?: string; // fallback
  onClose: () => void;
  onSave?: () => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !Number.isFinite(seconds)) return '0:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const formatTimeCompact = (seconds: number): string => {
  if (isNaN(seconds) || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const normalize = (s: string) => (s || '').trim();

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
  const [trackAuthorship, setTrackAuthorship] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // race-protection
  const requestIdRef = useRef(0);

  // ключ текущего трека/языка
  const keyNow = `${albumId}::${trackId}::${lang}`;

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  /**
   * ✅ СИНХРОННЫЙ СБРОС ДО PAINT
   * Это устраняет “на один кадр показывается старый текст” и ситуации,
   * когда старые тайминги начинают совпадать с новым аудио.
   */
  useLayoutEffect(() => {
    if (!isOpen) return;

    // инвалидируем все pending async цепочки
    requestIdRef.current += 1;

    // мгновенно чистим UI
    setSyncedLines([]);
    setTrackAuthorship('');
    setIsLoading(true);
    setIsDirty(false);
    setIsSaved(false);

    // важно: сброс таймера/длительности, чтобы ничего “старого” не синкалось
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    // стопаем текущее аудио (если было)
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, [isOpen, keyNow]);

  // Audio init (trackSrc)
  useEffect(() => {
    // прибиваем прошлый audio объект полностью
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (!trackSrc || !isOpen) return;

    const audio = new Audio(trackSrc);
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
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
  }, [trackSrc, isOpen]);

  // Data load on open / track change
  useEffect(() => {
    if (!isOpen) {
      requestIdRef.current += 1;
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const isRequestValid = () => currentRequestId === requestIdRef.current;

    const loadData = async () => {
      try {
        const textToUse = await loadTrackTextFromDatabase(albumId, trackId, lang).catch((error) => {
          console.error('[SyncLyricsModal] Failed to load text from DB:', error);
          return '';
        });

        if (!isRequestValid()) return;

        const createEmptyLine = (text: string): SyncedLyricsLine => ({
          text: text.trim(),
          startTime: 0,
          endTime: undefined,
        });

        const contentLines = textToUse
          ? textToUse
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
          : [];

        const contentSet = new Set(contentLines.map(normalize));

        clearSyncedLyricsCache(albumId, trackId, lang);

        // 1) load saved sync
        let storedSync: SyncedLyricsLine[] = [];
        try {
          storedSync = (await loadSyncedLyricsFromStorage(albumId, trackId, lang)) || [];
        } catch (e) {
          console.error('[SyncLyricsModal] Error loading synced lyrics:', e);
          storedSync = [];
        }

        if (!isRequestValid()) return;

        // 2) load authorship (source of truth)
        let authorshipToUse = '';
        try {
          const storedAuthorship = await Promise.race([
            loadAuthorshipFromStorage(albumId, trackId, lang),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
          authorshipToUse = normalize(storedAuthorship || propAuthorship || '');
        } catch {
          authorshipToUse = normalize(propAuthorship || '');
        }

        if (!isRequestValid()) return;

        // 3) Находим авторство в сохраненных данных (если есть)
        // ✅ ВАЖНО: Авторство теперь сохраняется как часть syncedLyrics, ищем его там
        const storedAuthLine = authorshipToUse
          ? storedSync.find((l) => normalize(l.text || '') === normalize(authorshipToUse))
          : null;

        // 4) build lyrics lines
        // ✅ ВАЖНО: Используем умное сопоставление с учетом порядка и контекста
        // чтобы дубликаты (припевы) получали правильные тайминги
        let linesToDisplay: SyncedLyricsLine[] = [];

        if (contentLines.length === 0) {
          linesToDisplay = [];
        } else if (storedSync.length > 0) {
          const storedOnlyLyrics = storedSync.filter((l) =>
            contentSet.has(normalize(l.text || ''))
          );

          // Создаем массив для отслеживания использованных строк из storedOnlyLyrics
          const usedIndices = new Set<number>();

          // Функция для поиска лучшего совпадения с учетом контекста
          const findBestMatch = (
            lineText: string,
            lineIndex: number,
            availableStored: SyncedLyricsLine[]
          ): SyncedLyricsLine | null => {
            const normalizedText = normalize(lineText);

            // Сначала пытаемся найти точное совпадение по позиции (если количество строк совпадает)
            if (storedOnlyLyrics.length === contentLines.length) {
              const byIndex = storedOnlyLyrics[lineIndex];
              if (
                byIndex &&
                !usedIndices.has(lineIndex) &&
                normalize(byIndex.text || '') === normalizedText
              ) {
                usedIndices.add(lineIndex);
                return byIndex;
              }
            }

            // Ищем совпадение с учетом контекста (предыдущие/следующие строки)
            // Это помогает различать дубликаты припевов
            for (let i = 0; i < availableStored.length; i++) {
              if (usedIndices.has(i)) continue;

              const stored = availableStored[i];
              if (normalize(stored.text || '') !== normalizedText) continue;

              // Проверяем контекст: предыдущая строка
              if (lineIndex > 0) {
                const prevContentLine = normalize(contentLines[lineIndex - 1]);
                if (i > 0) {
                  const prevStoredLine = availableStored[i - 1];
                  if (prevStoredLine && normalize(prevStoredLine.text || '') === prevContentLine) {
                    // Контекст совпадает - это хорошее совпадение
                    usedIndices.add(i);
                    return stored;
                  }
                }
              }

              // Проверяем контекст: следующая строка
              if (lineIndex < contentLines.length - 1) {
                const nextContentLine = normalize(contentLines[lineIndex + 1]);
                if (i < availableStored.length - 1) {
                  const nextStoredLine = availableStored[i + 1];
                  if (
                    nextStoredLine &&
                    normalize(nextStoredLine.text || '') === nextContentLine &&
                    !usedIndices.has(i + 1)
                  ) {
                    // Контекст совпадает - это хорошее совпадение
                    usedIndices.add(i);
                    return stored;
                  }
                }
              }
            }

            // Если контекст не помог, используем первое доступное совпадение
            for (let i = 0; i < availableStored.length; i++) {
              if (usedIndices.has(i)) continue;
              const stored = availableStored[i];
              if (normalize(stored.text || '') === normalizedText) {
                usedIndices.add(i);
                return stored;
              }
            }

            return null;
          };

          linesToDisplay = contentLines.map((lineText, i) => {
            const matched = findBestMatch(lineText, i, storedOnlyLyrics);
            return matched
              ? {
                  text: lineText.trim(),
                  startTime: matched.startTime ?? 0,
                  endTime: matched.endTime,
                }
              : createEmptyLine(lineText);
          });
        } else {
          linesToDisplay = contentLines.map(createEmptyLine);
        }

        // 5) add ONE authorship line at end (с сохранением startTime из сохраненных данных)
        if (authorshipToUse) {
          // Проверяем, не добавлено ли авторство уже в linesToDisplay
          const hasAuthorshipInDisplay = linesToDisplay.some(
            (l) => normalize(l.text || '') === normalize(authorshipToUse)
          );

          if (!hasAuthorshipInDisplay) {
            // Используем тайминг из сохраненных данных, если есть
            const preservedStart = storedAuthLine?.startTime ?? 0;
            const preservedEnd = storedAuthLine?.endTime;

            linesToDisplay.push({
              text: authorshipToUse,
              startTime: preservedStart, // Сохраняем тайминг из БД
              endTime: preservedEnd, // Сохраняем endTime из БД
            });
          }
        }

        if (!isRequestValid()) return;

        setTrackAuthorship(authorshipToUse);
        setSyncedLines(linesToDisplay);
      } catch (error) {
        console.error('[SyncLyricsModal] Load error:', error);
        if (!isRequestValid()) return;
        setSyncedLines([]);
        setTrackAuthorship('');
      } finally {
        if (isRequestValid()) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      requestIdRef.current += 1;
    };
    // ❗ duration НЕ включаем в deps: иначе при загрузке метаданных будет повторная загрузка текста
  }, [isOpen, albumId, trackId, lang, propAuthorship]);

  // When duration becomes known, force endTime for authorship to duration
  useEffect(() => {
    if (!duration || !trackAuthorship) return;

    setSyncedLines((prev) =>
      prev.map((line) => {
        const isAuth = normalize(line.text || '') === normalize(trackAuthorship);
        return isAuth ? { ...line, endTime: duration } : line;
      })
    );
  }, [duration, trackAuthorship]);

  const setLineTime = useCallback(
    (lineIndex: number, field: 'startTime' | 'endTime') => {
      const time = currentTime;

      setSyncedLines((prev) => {
        const newLines = [...prev];
        if (!newLines[lineIndex]) return prev;

        const nextLine: SyncedLyricsLine = {
          ...newLines[lineIndex],
          [field]: time,
        };

        const isAuthorshipLine =
          trackAuthorship && normalize(nextLine.text || '') === normalize(trackAuthorship);

        // authorship: endTime всегда duration
        if (isAuthorshipLine && field === 'startTime') {
          nextLine.endTime = duration > 0 ? duration : nextLine.endTime;
        }

        newLines[lineIndex] = nextLine;

        // normal lines: startTime closes previous line
        if (!isAuthorshipLine && field === 'startTime' && lineIndex > 0) {
          const prevLine = newLines[lineIndex - 1];
          newLines[lineIndex - 1] = { ...prevLine, endTime: time };
        }

        setIsDirty(true);
        setIsSaved(false);
        return newLines;
      });
    },
    [currentTime, duration, trackAuthorship]
  );

  const clearEndTime = useCallback((lineIndex: number) => {
    setSyncedLines((prev) => {
      const newLines = [...prev];
      if (!newLines[lineIndex]) return prev;

      const { endTime, ...rest } = newLines[lineIndex];
      newLines[lineIndex] = rest;

      setIsDirty(true);
      setIsSaved(false);
      return newLines;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (syncedLines.length === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: 'Нет строк для сохранения',
        variant: 'error',
      });
      return;
    }

    setIsSaving(true);

    try {
      const storedAuthorship = await loadAuthorshipFromStorage(albumId, trackId, lang).catch(
        () => null
      );
      const authorshipToSave = normalize(
        storedAuthorship || trackAuthorship || propAuthorship || ''
      );

      // ✅ ВАЖНО: Авторство ДОЛЖНО быть частью syncedLyrics, чтобы сохранить его тайминг
      // Фильтруем только пустые строки, НЕ фильтруем авторство
      const linesToSave = syncedLines
        .filter((l) => {
          const t = normalize(l.text || '');
          // Удаляем только пустые строки
          return t.length > 0;
        })
        .map((line) => {
          // Для авторства устанавливаем endTime=duration, если не задан
          const isAuth = authorshipToSave && normalize(line.text || '') === authorshipToSave;
          if (isAuth && line.endTime === undefined && duration > 0) {
            return { ...line, endTime: duration };
          }
          return line;
        });

      const result = await saveSyncedLyrics({
        albumId,
        trackId,
        lang,
        syncedLyrics: linesToSave,
        authorship: authorshipToSave || undefined,
      });

      if (result.success) {
        // ✅ ВАЖНО: Авторство уже в linesToSave с правильным таймингом
        // Обновляем локальное состояние тем же массивом, что был сохранен
        setSyncedLines(linesToSave);

        setIsDirty(false);
        setIsSaved(true);
        clearSyncedLyricsCache(albumId, trackId, lang);

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
          setCurrentTime(0);
        }

        onSave?.();
      } else {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: `❌ Ошибка сохранения: ${result.message || 'Неизвестная ошибка'}`,
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('[SyncLyricsModal] Save error:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: '❌ Ошибка сохранения синхронизаций',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [albumId, trackId, lang, syncedLines, propAuthorship, onSave, trackAuthorship, duration]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((error) => console.error('Ошибка воспроизведения:', error));
      setIsPlaying(true);
    }
  }, [isPlaying]);

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
    <>
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

              {/* tracks__duration не ломаем */}
              <div className="sync-lyrics-modal__time">{formatTimeCompact(currentTime)}</div>
              <div className="sync-lyrics-modal__progress-bar" onClick={handleProgressClick}>
                <div
                  className="sync-lyrics-modal__progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="sync-lyrics-modal__duration">{formatTimeCompact(duration)}</div>
            </div>

            <div className="sync-lyrics-modal__divider"></div>

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
                    {syncedLines.map((line, index) => {
                      const isAuthorshipLine =
                        trackAuthorship &&
                        normalize(line.text || '') === normalize(trackAuthorship);

                      return (
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
                            {isAuthorshipLine ? (
                              <span className="sync-lyrics-modal__time-disabled">
                                {formatTime(duration)}
                              </span>
                            ) : line.endTime !== undefined && line.endTime > 0 ? (
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
                            {!isAuthorshipLine &&
                              line.endTime !== undefined &&
                              line.endTime > 0 && (
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
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

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

      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          onClose={() => setAlertModal(null)}
        />
      )}
    </>
  );
}
