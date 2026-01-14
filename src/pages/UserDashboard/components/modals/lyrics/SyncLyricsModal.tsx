// src/pages/UserDashboard/components/SyncLyricsModal.tsx
import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
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

  // IMPORTANT: race-protection
  const requestIdRef = useRef(0);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Audio init
  useEffect(() => {
    if (!trackSrc) return;

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
  }, [trackSrc]);

  // Data load on open / track change
  useEffect(() => {
    if (!isOpen) {
      // invalidate any pending async chain if modal closed
      requestIdRef.current += 1;
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    const isRequestValid = () => currentRequestId === requestIdRef.current;

    const loadData = async () => {
      // reset state immediately (so no "old track" flashes)
      setSyncedLines([]);
      setTrackAuthorship('');
      setIsLoading(true);
      setIsDirty(false);
      setIsSaved(false);

      let authorshipDetected = '';

      try {
        const textToUse = await loadTrackTextFromDatabase(albumId, trackId, lang).catch((error) => {
          console.error('[SyncLyricsModal] Failed to load text from DB:', error);
          return '';
        });

        if (!isRequestValid()) return;

        let linesToDisplay: SyncedLyricsLine[] = [];

        const createEmptyLine = (text: string): SyncedLyricsLine => ({
          text: text.trim(),
          startTime: 0,
          endTime: undefined,
        });

        if (textToUse) {
          const contentLines = textToUse.split('\n').filter((line) => line.trim());

          clearSyncedLyricsCache(albumId, trackId, lang);

          try {
            const storedSync = await loadSyncedLyricsFromStorage(albumId, trackId, lang);
            if (!isRequestValid()) return;

            if (storedSync && storedSync.length > 0) {
              const storedAuthorship = await loadAuthorshipFromStorage(
                albumId,
                trackId,
                lang
              ).catch(() => null);
              if (!isRequestValid()) return;

              const a = (storedAuthorship || propAuthorship || '').trim();

              const storedMain = storedSync.filter((line) => {
                const lineText = (line.text || '').trim();
                return !(a && lineText === a);
              });

              if (storedMain.length === contentLines.length) {
                linesToDisplay = storedMain.map((storedLine, index) => {
                  const currentLine = contentLines[index];
                  return {
                    text: currentLine ? currentLine.trim() : storedLine.text.trim(),
                    startTime: storedLine.startTime,
                    endTime: storedLine.endTime,
                  };
                });
              } else {
                linesToDisplay = contentLines.map((currentLine) => {
                  const matchedLine = storedMain.find(
                    (stored) => stored.text.trim() === currentLine.trim()
                  );
                  return matchedLine
                    ? {
                        text: currentLine.trim(),
                        startTime: matchedLine.startTime,
                        endTime: matchedLine.endTime,
                      }
                    : createEmptyLine(currentLine);
                });
              }
            } else {
              linesToDisplay = contentLines.map(createEmptyLine);
            }
          } catch (syncError) {
            console.error('[SyncLyricsModal] Error loading synced lyrics:', syncError);
            linesToDisplay = contentLines.map(createEmptyLine);
          }
        } else {
          linesToDisplay = [];
        }

        // authorship (display-only last row)
        try {
          const storedAuthorship = await Promise.race([
            loadAuthorshipFromStorage(albumId, trackId, lang),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);

          if (!isRequestValid()) return;

          const authorshipToUse = storedAuthorship || propAuthorship || null;

          if (authorshipToUse && authorshipToUse.trim()) {
            const trimmed = authorshipToUse.trim();
            authorshipDetected = trimmed;

            const last = linesToDisplay[linesToDisplay.length - 1];
            if (!last || last.text.trim() !== trimmed) {
              linesToDisplay.push({
                text: trimmed,
                startTime: 0,
                endTime: undefined,
              });
            }
          }
        } catch (authorshipError) {
          console.warn('Не удалось загрузить авторство:', authorshipError);
        }

        if (!isRequestValid()) return;

        setTrackAuthorship(authorshipDetected);
        setSyncedLines(linesToDisplay);
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        if (!isRequestValid()) return;
        setSyncedLines([]);
      } finally {
        if (isRequestValid()) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    // cleanup: invalidate this request chain on unmount/dep change
    return () => {
      requestIdRef.current += 1;
    };
  }, [isOpen, albumId, trackId, lang, propAuthorship]);

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

        if (field === 'startTime' && lineIndex > 0) {
          const prevLine = newLines[lineIndex - 1];
          newLines[lineIndex - 1] = { ...prevLine, endTime: time };
        }

        setIsDirty(true);
        return newLines;
      });
    },
    [currentTime]
  );

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
      const authorshipToSave = (storedAuthorship || trackAuthorship || propAuthorship || '').trim();

      const linesToSave = syncedLines.filter((line) => {
        const lineText = (line.text || '').trim();
        return !(authorshipToSave && lineText === authorshipToSave);
      });

      const result = await saveSyncedLyrics({
        albumId,
        trackId,
        lang,
        syncedLyrics: linesToSave,
        authorship: authorshipToSave || undefined,
      });

      if (result.success) {
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
      console.error('Ошибка сохранения:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: '❌ Ошибка сохранения синхронизаций',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [albumId, trackId, lang, syncedLines, propAuthorship, onSave, trackAuthorship]);

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
                        trackAuthorship && line.text.trim() === trackAuthorship.trim();

                      return (
                        <div key={index} className="sync-lyrics-modal__table-row">
                          <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--number">
                            {index + 1}
                          </div>
                          <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--lyrics">
                            {line.text}
                          </div>

                          <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--start">
                            {isAuthorshipLine ? (
                              <span className="sync-lyrics-modal__time-disabled">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLineTime(index, 'startTime')}
                                className="sync-lyrics-modal__time-btn"
                                disabled={currentTime === 0 && !isPlaying}
                              >
                                {formatTime(line.startTime)}
                              </button>
                            )}
                          </div>

                          <div className="sync-lyrics-modal__table-col sync-lyrics-modal__table-col--end">
                            {isAuthorshipLine ? (
                              <span className="sync-lyrics-modal__time-disabled">—</span>
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
