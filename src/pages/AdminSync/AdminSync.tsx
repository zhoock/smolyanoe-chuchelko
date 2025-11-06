// src/pages/AdminSync/AdminSync.tsx
/**
 * Админ-страница для синхронизации текста песни с музыкой.
 * Позволяет устанавливать тайм-коды для каждой строки текста вручную.
 */
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAlbumsData } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, playerSelectors } from '@features/player';
import { audioController } from '@features/player/model/lib/audioController';
import type { SyncedLyricsLine } from '../../models';
import { AlbumCover } from '@entities/album';
import {
  saveSyncedLyrics,
  loadSyncedLyricsFromStorage,
  loadAuthorshipFromStorage,
} from '../../utils/syncedLyrics';
import { loadTrackTextFromStorage } from '../../utils/trackText';
import './style.scss';

export default function AdminSync() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '', trackId = '' } = useParams<{ albumId: string; trackId: string }>();

  const dispatch = useAppDispatch();

  // Получаем текущее время из Redux плеера для установки тайм-кодов
  const currentTime = useAppSelector(playerSelectors.selectTime);
  const isPlaying = useAppSelector(playerSelectors.selectIsPlaying);

  const [syncedLines, setSyncedLines] = useState<SyncedLyricsLine[]>([]);
  const [isDirty, setIsDirty] = useState(false); // флаг изменений
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null); // для отслеживания смены трека
  const [lastTextHash, setLastTextHash] = useState<string | null>(null); // хэш текста для отслеживания изменений
  const [isSaved, setIsSaved] = useState(false); // флаг успешного сохранения

  // Инициализируем плейлист в Redux когда загружаются данные альбома
  // Это нужно чтобы AudioPlayer мог отобразить название трека вместо "Unknown Track"
  useEffect(() => {
    if (!data) return;

    data.templateA.then((albums) => {
      const album = albums.find((a) => a.albumId === albumId);
      if (!album) return;

      const track = album.tracks.find((t) => String(t.id) === trackId);
      if (!track) return;

      // Устанавливаем плейлист и текущий трек
      dispatch(playerActions.setPlaylist(album.tracks || []));

      // Находим индекс текущего трека в плейлисте
      const trackIndex = album.tracks.findIndex((t) => String(t.id) === trackId);
      if (trackIndex >= 0) {
        dispatch(playerActions.setCurrentTrackIndex(trackIndex));
        dispatch(
          playerActions.setAlbumInfo({
            albumId: album.albumId || albumId,
            albumTitle: album.album,
          })
        );
      }
    });
  }, [data, albumId, trackId, dispatch]);

  // Отслеживаем изменения текста в localStorage (для обновления при сохранении в другой вкладке)
  useEffect(() => {
    if (!albumId || !trackId || !lang) return;

    const checkTextUpdate = () => {
      const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
      const storedAuthorship = loadAuthorshipFromStorage(albumId, trackId, lang);
      const textToUse = storedText || '';
      const newHash = `${textToUse}-${storedAuthorship || ''}`;

      // Если текст изменился - обновляем список строк
      if (newHash !== lastTextHash && textToUse) {
        setSyncedLines((prev) => {
          // Разбиваем новый текст на строки
          const contentLines = textToUse.split('\n').filter((line) => line.trim());
          const textLines = contentLines.map((line) => line.trim());

          // Создаём маппинг: текст строки -> существующая строка с таймкодами
          const existingLinesMap = new Map<string, SyncedLyricsLine>();
          prev.forEach((line) => {
            // Пропускаем строку авторства при построении маппинга
            if (storedAuthorship && line.text === storedAuthorship) {
              return;
            }
            existingLinesMap.set(line.text, line);
          });

          // Создаём новые строки, сохраняя таймкоды для существующих
          const newLines: SyncedLyricsLine[] = textLines.map((text) => {
            const existing = existingLinesMap.get(text);
            if (existing) {
              // Сохраняем таймкоды для существующей строки
              return existing;
            } else {
              // Новая строка без таймкодов
              return {
                text,
                startTime: 0,
                endTime: undefined,
              };
            }
          });

          // Добавляем авторство в конец, если оно есть
          if (storedAuthorship) {
            const existingAuthorship = prev.find((line) => line.text === storedAuthorship);
            if (existingAuthorship) {
              // Сохраняем таймкоды для авторства
              newLines.push(existingAuthorship);
            } else {
              // Новое авторство без таймкодов
              newLines.push({
                text: storedAuthorship,
                startTime: currentTime.duration || 0,
                endTime: undefined,
              });
            }
          }

          return newLines;
        });
        setLastTextHash(newHash);
        setIsDirty(true); // Помечаем как изменённое, чтобы пользователь мог сохранить
      }
    };

    // Проверяем сразу
    checkTextUpdate();

    // Проверяем каждые 2 секунды
    const interval = setInterval(checkTextUpdate, 2000);

    return () => clearInterval(interval);
  }, [albumId, trackId, lang, lastTextHash, currentTime.duration]);

  // Установить тайм-код для конкретной строки
  const setLineTime = useCallback(
    (lineIndex: number, field: 'startTime' | 'endTime') => {
      const time = field === 'startTime' ? currentTime.current : currentTime.current;

      setSyncedLines((prev) => {
        const newLines = [...prev];
        if (!newLines[lineIndex]) return prev;

        newLines[lineIndex] = {
          ...newLines[lineIndex],
          [field]: time,
        };

        // Если устанавливаем startTime, автоматически устанавливаем endTime предыдущей строки (если есть)
        if (field === 'startTime' && lineIndex > 0 && !newLines[lineIndex - 1].endTime) {
          newLines[lineIndex - 1] = {
            ...newLines[lineIndex - 1],
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

    // Загружаем авторство для передачи в сохранение (но не редактируем его здесь)
    const storedAuthorship = loadAuthorshipFromStorage(albumId, trackId, lang);

    // Получаем трек для получения авторства из JSON
    let trackAuthorship = '';
    if (data) {
      const albums = await data.templateA;
      const album = albums.find((a) => a.albumId === albumId);
      const track = album?.tracks.find((t) => String(t.id) === trackId);
      trackAuthorship = track?.authorship || storedAuthorship || '';
    } else {
      trackAuthorship = storedAuthorship || '';
    }

    // Фильтруем строки авторства из syncedLines перед сохранением
    // (если у строки авторства нет таймкодов, она не должна сохраняться в syncedLyrics)
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
      // После успешного сохранения перезагружаем синхронизации из localStorage
      // чтобы отобразить актуальные сохранённые данные
      const savedSync = loadSyncedLyricsFromStorage(albumId, trackId, lang);
      if (savedSync && savedSync.length > 0) {
        // Добавляем авторство в конец, если оно есть
        const updatedLines = [...savedSync];
        if (trackAuthorship) {
          const lastLine = updatedLines[updatedLines.length - 1];
          if (!lastLine || lastLine.text !== trackAuthorship) {
            updatedLines.push({
              text: trackAuthorship,
              startTime: currentTime.duration || 0,
              endTime: undefined,
            });
          }
        }
        setSyncedLines(updatedLines);
      }

      setIsDirty(false);
      setIsSaved(true);
    } else {
      setIsSaved(false);
      alert(`❌ Ошибка сохранения: ${result.message || 'Неизвестная ошибка'}`);
    }
  }, [albumId, trackId, lang, syncedLines, data, currentTime.duration]);

  // Ref для контейнера audio элемента
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  // Прикрепляем audio элемент к DOM при монтировании
  useEffect(() => {
    if (audioContainerRef.current && !audioContainerRef.current.contains(audioController.element)) {
      audioContainerRef.current.appendChild(audioController.element);
    }
  }, []);

  // Форматирование времени для отображения (MM:SS)
  const formatTimeCompact = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Форматирование времени для отображения (с миллисекундами для тайм-кодов)
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }, []);

  // Переключение play/pause
  const togglePlayPause = useCallback(() => {
    dispatch(playerActions.toggle());
  }, [dispatch]);

  // Обработка клика по прогресс-бару
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
      const progressBar = e.currentTarget;
      const rect = progressBar.getBoundingClientRect();
      let clickX: number;

      if ('clientX' in e) {
        clickX = e.clientX - rect.left;
      } else {
        // Для клавиатуры используем центр прогресс-бара
        clickX = rect.width / 2;
      }

      const progress = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = progress * (currentTime.duration || 0);

      dispatch(playerActions.setSeeking(true));
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration: currentTime.duration }));
      dispatch(playerActions.setProgress(progress * 100));

      // Автоматически возобновляем воспроизведение после перемотки
      setTimeout(() => {
        dispatch(playerActions.setSeeking(false));
        if (isPlaying) {
          dispatch(playerActions.play());
        }
      }, 100);
    },
    [dispatch, currentTime.duration, isPlaying]
  );

  // Получаем прогресс для отображения
  const progress = useMemo(() => {
    if (!currentTime.duration) return 0;
    return (currentTime.current / currentTime.duration) * 100;
  }, [currentTime]);

  if (!data) {
    return (
      <div className="admin-sync">
        <Loader />
      </div>
    );
  }

  return (
    <div className="admin-sync">
      <DataAwait
        value={data.templateA}
        fallback={<Loader />}
        error={<ErrorMessage error="Не удалось загрузить данные трека" />}
      >
        {(albums) => {
          const album = albums.find((a) => a.albumId === albumId);

          // Отладочная информация
          if (!album) {
            console.warn('❌ Альбом не найден:', {
              albumId,
              availableAlbums: albums.map((a) => a.albumId),
            });
            return (
              <ErrorMessage
                error={`Альбом "${albumId}" не найден. Доступные: ${albums.map((a) => a.albumId).join(', ')}`}
              />
            );
          }

          const track = album.tracks.find((t) => String(t.id) === trackId);

          if (!track) {
            console.warn('❌ Трек не найден:', {
              trackId,
              albumId,
              availableTracks: album.tracks.map((t) => ({ id: t.id, title: t.title })),
            });
            return (
              <ErrorMessage
                error={`Трек #${trackId} не найден в альбоме "${album.album}". Доступные треки: ${album.tracks.map((t) => `${t.id} - ${t.title}`).join(', ')}`}
              />
            );
          }

          // Загружаем авторство (только для добавления в список строк, не для редактирования)
          const storedAuthorship = loadAuthorshipFromStorage(albumId, track.id, lang);
          const trackAuthorship = track.authorship || storedAuthorship || '';

          // Сначала проверяем localStorage (для dev mode)
          const storedSync = loadSyncedLyricsFromStorage(albumId, track.id, lang);

          // Проверяем сохранённый текст из админки текста
          const storedText = loadTrackTextFromStorage(albumId, track.id, lang);
          const textToUse = storedText || track.content || '';

          // Вычисляем хэш текста для отслеживания изменений
          const textHash = `${textToUse}-${trackAuthorship}`;

          // Обновляем хэш в состоянии, если он изменился (для корректной работы useEffect)
          if (textHash !== lastTextHash) {
            setLastTextHash(textHash);
          }

          // Инициализируем или обновляем синхронизации при:
          // 1. Смене трека
          // 2. Изменении текста (если нет сохранённых синхронизаций)
          const shouldUpdate =
            currentTrackId !== String(track.id) ||
            (!storedSync && !track.syncedLyrics && lastTextHash !== textHash);

          if (shouldUpdate) {
            if (currentTrackId !== String(track.id)) {
              setCurrentTrackId(String(track.id));
            }

            let linesToDisplay: SyncedLyricsLine[] = [];

            if (storedSync && storedSync.length > 0) {
              // Используем сохранённые в localStorage синхронизации
              linesToDisplay = storedSync;
            } else if (track.syncedLyrics && track.syncedLyrics.length > 0) {
              // Используем синхронизации из JSON файла
              linesToDisplay = track.syncedLyrics;
            } else {
              // Разбиваем обычный текст на строки
              const contentLines = textToUse.split('\n').filter((line) => line.trim());
              linesToDisplay = contentLines.map((line) => ({
                text: line.trim(),
                startTime: 0,
                endTime: undefined,
              }));
            }

            // Добавляем строку авторства в конец, если она есть
            if (trackAuthorship) {
              // Проверяем, не добавлена ли уже строка авторства в конец
              const lastLine = linesToDisplay[linesToDisplay.length - 1];
              if (!lastLine || lastLine.text !== trackAuthorship) {
                linesToDisplay.push({
                  text: trackAuthorship,
                  startTime: currentTime.duration || 0,
                  endTime: undefined,
                });
              }
            }

            setSyncedLines(linesToDisplay);
            setLastTextHash(textHash);
            setIsDirty(false);
            setIsSaved(false); // Сбрасываем флаг сохранения при изменении данных
          }

          return (
            <>
              <div className="admin-sync__header">
                <div className="admin-sync__header-top">
                  <h1>Синхронизация текста</h1>
                  <Link
                    to={`/admin/text/${albumId}/${trackId}`}
                    className="admin-sync__link-to-text"
                  >
                    ← Редактировать текст
                  </Link>
                </div>
              </div>

              {/* Компактный плеер для прослушивания трека */}
              <div className="admin-sync__player">
                <div className="admin-sync__player-container" ref={audioContainerRef}>
                  {/* Audio элемент будет вставлен сюда автоматически */}
                </div>
                <div className="admin-sync__player-wrapper">
                  <div className="admin-sync__player-cover">
                    <AlbumCover
                      {...album.cover}
                      fullName={`${album.artist} - ${album.album}`}
                      size={448}
                    />
                  </div>
                  <div className="admin-sync__player-info">
                    <div className="admin-sync__player-title">{track.title}</div>
                    <div className="admin-sync__player-artist">{album.artist}</div>
                  </div>
                  <div className="admin-sync__player-controls">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="admin-sync__player-play-btn"
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
                  <div className="admin-sync__player-progress-wrapper">
                    <div
                      className="admin-sync__player-progress"
                      onClick={handleProgressClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleProgressClick(e);
                        }
                      }}
                      aria-label="Прогресс воспроизведения"
                    >
                      <div
                        className="admin-sync__player-progress-bar"
                        style={{ width: `${progress}%` }}
                      />
                      <div
                        className="admin-sync__player-progress-handle"
                        style={{ left: `${progress}%` }}
                      />
                    </div>
                    <div className="admin-sync__player-time">
                      <span>{formatTimeCompact(currentTime.current)}</span>
                      <span>{formatTimeCompact(currentTime.duration || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Список строк с тайм-кодами */}
              <div className="admin-sync__lines">
                <div className="admin-sync__lines-list">
                  {syncedLines.map((line, index) => (
                    <div key={index} className="admin-sync__line">
                      <div className="admin-sync__line-number">{index + 1}</div>
                      <div className="admin-sync__line-text">{line.text}</div>
                      <div className="admin-sync__line-times">
                        <button
                          type="button"
                          onClick={() => setLineTime(index, 'startTime')}
                          className="admin-sync__time-btn"
                          disabled={currentTime.current === 0 && !isPlaying}
                        >
                          {formatTime(line.startTime)}
                        </button>
                        {line.endTime !== undefined ? (
                          <>
                            <span className="admin-sync__time-value">
                              {formatTime(line.endTime)}
                            </span>
                            <button
                              type="button"
                              onClick={() => clearEndTime(index)}
                              className="admin-sync__time-btn admin-sync__time-btn--clear"
                              title="Сбросить конец строки"
                            >
                              ✖️ Сбросить конец
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLineTime(index, 'endTime')}
                            className="admin-sync__time-btn"
                            disabled={currentTime.current === 0 && !isPlaying}
                          >
                            Установить конец
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="admin-sync__controls">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty}
                    className="admin-sync__save-btn"
                  >
                    Сохранить синхронизации
                  </button>
                  {isSaved && (
                    <span className="admin-sync__saved-indicator">Синхронизации сохранены</span>
                  )}
                  {isDirty && (
                    <span className="admin-sync__dirty-indicator">
                      Есть несохранённые изменения
                    </span>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </DataAwait>
    </div>
  );
}
