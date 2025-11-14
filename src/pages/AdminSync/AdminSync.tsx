// src/pages/AdminSync/AdminSync.tsx
/**
 * Админ-страница для синхронизации текста песни с музыкой.
 * Позволяет устанавливать тайм-коды для каждой строки текста вручную.
 */
import { useCallback, useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { Breadcrumb } from '@shared/ui/breadcrumb';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerActions, playerSelectors } from '@features/player';
import { audioController } from '@features/player/model/lib/audioController';
import type { SyncedLyricsLine } from '@/models';
import { AlbumCover } from '@entities/album';
import { selectAlbumsStatus, selectAlbumsError, selectAlbumById } from '@entities/album';
import {
  saveSyncedLyrics,
  loadSyncedLyricsFromStorage,
  loadAuthorshipFromStorage,
} from '@features/syncedLyrics/lib';
import { loadTrackTextFromStorage } from '@entities/track/lib';
import './style.scss';

export default function AdminSync() {
  const { lang } = useLang();
  const { albumId = '', trackId = '' } = useParams<{ albumId: string; trackId: string }>();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const album = useAppSelector((state) => selectAlbumById(state, lang, albumId));

  const dispatch = useAppDispatch();

  // Получаем текущее время из Redux плеера для установки тайм-кодов
  // Используем один селектор selectTime для атомарного получения обоих значений (как в AudioPlayer)
  const time = useAppSelector(playerSelectors.selectTime);
  const currentTime = time; // Алиас для совместимости с остальным кодом
  const isPlaying = useAppSelector(playerSelectors.selectIsPlaying);
  const progress = useAppSelector(playerSelectors.selectProgress);
  const isSeeking = useAppSelector(playerSelectors.selectIsSeeking);

  const [syncedLines, setSyncedLines] = useState<SyncedLyricsLine[]>([]);
  const [isDirty, setIsDirty] = useState(false); // флаг изменений
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null); // для отслеживания смены трека
  const [lastTextHash, setLastTextHash] = useState<string | null>(null); // хэш текста для отслеживания изменений
  const [isSaved, setIsSaved] = useState(false); // флаг успешного сохранения
  const [isLoading, setIsLoading] = useState(true); // флаг загрузки данных
  const initializedRef = useRef<string | null>(null); // ref для отслеживания инициализированного трека

  // Инициализируем плейлист в Redux когда загружаются данные альбома
  // ВАЖНО: При загрузке страницы синхронизации останавливаем воспроизведение и сбрасываем время
  useEffect(() => {
    if (!album || albumsStatus !== 'succeeded') return;

    const track = album.tracks.find((t) => String(t.id) === trackId);
    if (!track) return;

    // Останавливаем воспроизведение при загрузке страницы синхронизации
    dispatch(playerActions.pause());
    audioController.pause();

    // Сбрасываем время на 0
    dispatch(playerActions.setCurrentTime(0));
    dispatch(playerActions.setProgress(0));
    audioController.setCurrentTime(0);

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
      // Явно устанавливаем источник трека, чтобы загрузить метаданные
      // Глобальный обработчик loadedmetadata в playerListeners.ts обновит duration автоматически
      if (track.src) {
        audioController.setSource(track.src);
      }
    }
  }, [album, albumsStatus, albumId, trackId, dispatch]);

  // Отслеживаем изменения текста в localStorage (для обновления при сохранении в другой вкладке)
  useEffect(() => {
    if (!albumId || !trackId || !lang) return;

    const checkTextUpdate = () => {
      const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
      const storedAuthorship = loadAuthorshipFromStorage(albumId, trackId, lang);
      const textToUse = storedText || '';
      const newHash = `${textToUse}-${storedAuthorship || ''}`;

      // Обновляем только если текст действительно изменился (не при первой загрузке)
      // При первой загрузке данные загружаются в основном рендере
      // Также не обновляем, если данные ещё не инициализированы
      if (lastTextHash !== null && newHash !== lastTextHash && initializedRef.current !== null) {
        console.log('🔄 Текст изменился, обновляем синхронизации:', {
          oldHash: lastTextHash,
          newHash,
        });
        setSyncedLines((prev) => {
          // Если текст пустой - очищаем все строки (кроме авторства, если оно есть)
          if (!textToUse || !textToUse.trim()) {
            // Если есть авторство - оставляем только его
            if (storedAuthorship) {
              const existingAuthorship = prev.find((line) => line.text === storedAuthorship);
              if (existingAuthorship) {
                // Сохраняем таймкоды для авторства
                return [existingAuthorship];
              } else {
                // Новое авторство без таймкодов
                return [
                  {
                    text: storedAuthorship,
                    startTime: currentTime.duration || 0,
                    endTime: undefined,
                  },
                ];
              }
            }
            // Если нет авторства и текст пустой - возвращаем пустой массив
            return [];
          }

          // Разбиваем новый текст на строки
          const contentLines = textToUse.split('\n').filter((line) => line.trim());
          const textLines = contentLines.map((line) => line.trim());

          // Если текст изменился - обнуляем все таймкоды (создаём новые строки без таймкодов)
          // Это логично: если пользователь редактирует текст, он хочет заново синхронизировать
          const newLines: SyncedLyricsLine[] = textLines.map((text) => ({
            text,
            startTime: 0,
            endTime: undefined,
          }));

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
        // Сбрасываем initializedRef, чтобы основной useEffect перезагрузил данные
        initializedRef.current = null;
      } else if (lastTextHash === null) {
        // При первой загрузке просто устанавливаем хэш, не трогая данные
        // Данные загружаются в основном рендере
        setLastTextHash(newHash);
      }
    };

    // Проверяем сразу
    checkTextUpdate();

    // Проверяем каждые 2 секунды
    const interval = setInterval(checkTextUpdate, 2000);

    return () => clearInterval(interval);
  }, [albumId, trackId, lang, lastTextHash, currentTime.duration]);

  // Инициализация синхронизаций при загрузке данных
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 useEffect запущен:', {
        hasAlbum: !!album,
        albumsStatus,
        albumId,
        trackId,
        currentTrackId,
        initializedRef: initializedRef.current,
      });
    }

    if (albumsStatus !== 'succeeded' || !album) {
      setIsLoading(false);
      return;
    }

    // Проверяем, изменился ли трек, используя initializedRef
    const trackIdStr = trackId;

    // Если трек уже инициализирован - не загружаем заново
    if (initializedRef.current === trackIdStr) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Трек уже инициализирован, пропускаем загрузку');
      }
      setIsLoading(false);
      return;
    }

    // Если трек изменился (initializedRef не совпадает) - сбрасываем состояние
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Трек изменился или не инициализирован, загружаем данные');
    }

    // Проверяем, изменился ли текст (если lastTextHash установлен)
    // Если текст изменился, checkTextUpdate уже обновил syncedLines, не сбрасываем их
    const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
    const storedAuthorship = loadAuthorshipFromStorage(albumId, trackId, lang);
    const textToUse = storedText || '';
    const currentTextHash = `${textToUse}-${storedAuthorship || ''}`;
    const textChanged = lastTextHash !== null && lastTextHash !== currentTextHash;

    // Сбрасываем syncedLines только если трек действительно изменился, а не только текст
    // Если текст изменился, checkTextUpdate уже обновил syncedLines
    if (!textChanged) {
      setSyncedLines([]);
    }
    setIsDirty(false);
    setIsSaved(false);
    setIsLoading(true); // Показываем лоадер при смене трека

    // Данные загружаются через loader, используем album из Redux
    if (albumsStatus !== 'succeeded' || !album) {
      setIsLoading(false);
      return;
    }

    const track = album.tracks.find((t) => String(t.id) === trackId);
    if (!track) {
      setIsLoading(false);
      return;
    }

    // Используем синхронный код вместо промиса
    (() => {
      const currentTrackIdStr = String(track.id);

      // Загружаем авторство
      const storedAuthorship = loadAuthorshipFromStorage(albumId, track.id, lang);
      const trackAuthorship = track.authorship || storedAuthorship || '';

      // Загружаем сохранённые синхронизации
      const storedSync = loadSyncedLyricsFromStorage(albumId, track.id, lang);

      // Проверяем сохранённый текст из админки текста
      const storedText = loadTrackTextFromStorage(albumId, track.id, lang);
      const textToUse = storedText || track.content || '';

      // Вычисляем хэш текста
      const textHash = `${textToUse}-${trackAuthorship}`;

      // Логирование только в development для отладки
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Инициализация синхронизаций:', {
          albumId,
          trackId: track.id,
          lang,
          hasStoredSync: !!storedSync,
          storedSyncLength: storedSync?.length || 0,
        });
      }

      // Проверяем, изменился ли текст
      // Текст считается изменившимся только если есть сохранённый текст И он отличается от текста в JSON
      const textChanged =
        storedText !== null &&
        storedText !== undefined &&
        storedText.trim() !== (track.content || '').trim();

      // Вычисляем хэш текущего текста для сравнения
      const currentTextHash = `${textToUse}-${trackAuthorship}`;

      // Проверяем, изменился ли текст с момента последнего сохранения
      // Если lastTextHash установлен и отличается от текущего - текст изменился
      const textChangedSinceSave = lastTextHash !== null && lastTextHash !== currentTextHash;

      // Также проверяем, совпадает ли текст в сохранённых синхронизациях с текущим текстом
      // Если не совпадает - текст изменился, игнорируем сохранённые синхронизации
      let textMatchesStoredSync = true;
      if (storedSync && storedSync.length > 0) {
        const currentLines = textToUse.split('\n').filter((line) => line.trim());
        const storedLines = storedSync
          .filter((line) => line.text !== trackAuthorship) // Исключаем авторство
          .map((line) => line.text.trim());
        textMatchesStoredSync =
          currentLines.length === storedLines.length &&
          currentLines.every((line, index) => line.trim() === storedLines[index]);
      }

      let linesToDisplay: SyncedLyricsLine[] = [];

      // ПРИОРИТЕТ: Если текст изменился после сохранения - игнорируем сохранённые синхронизации
      // Иначе используем сохранённые синхронизации, если они есть
      if (textChangedSinceSave || !textMatchesStoredSync) {
        // Текст изменился после сохранения - создаём новые строки без таймкодов
        if (process.env.NODE_ENV === 'development') {
          console.log('📝 Текст изменился после сохранения, сбрасываем таймкоды', {
            textChangedSinceSave,
            textMatchesStoredSync,
          });
        }
        const contentLines = textToUse.split('\n').filter((line) => line.trim());
        linesToDisplay = contentLines.map((line) => ({
          text: line.trim(),
          startTime: 0,
          endTime: undefined,
        }));
      } else if (storedSync && storedSync.length > 0) {
        // Используем сохранённые в localStorage синхронизации (текст не изменился)
        if (process.env.NODE_ENV === 'development') {
          console.log('📥 Загрузка сохранённых синхронизаций из localStorage:', {
            albumId,
            trackId: track.id,
            lang,
            linesCount: storedSync.length,
          });
        }
        linesToDisplay = storedSync;
      } else if (textChanged) {
        // Текст изменился И нет сохранённых синхронизаций - создаём новые строки без таймкодов
        console.log('📝 Текст изменился, создаём новые строки без таймкодов');
        const contentLines = textToUse.split('\n').filter((line) => line.trim());
        linesToDisplay = contentLines.map((line) => ({
          text: line.trim(),
          startTime: 0,
          endTime: undefined,
        }));
      } else if (track.syncedLyrics && track.syncedLyrics.length > 0) {
        // Используем синхронизации из JSON файла (текст не изменился)
        console.log('📄 Используем синхронизации из JSON файла');
        linesToDisplay = track.syncedLyrics;
      } else {
        // Разбиваем обычный текст на строки
        console.log('📝 Создаём строки из обычного текста');
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

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Установка синхронизаций:', {
          linesCount: linesToDisplay.length,
          firstLine: linesToDisplay[0]?.text?.substring(0, 30),
        });
      }

      // Устанавливаем данные
      setSyncedLines(linesToDisplay);
      setLastTextHash(textHash);
      setCurrentTrackId(String(track.id));
      setIsDirty(false);
      setIsSaved(false);
      initializedRef.current = String(track.id);
      setIsLoading(false); // Загрузка завершена

      if (process.env.NODE_ENV === 'development') {
        console.log(
          '✅ Загрузка завершена, syncedLines установлен, linesCount:',
          linesToDisplay.length
        );
      }
    })();
  }, [
    album,
    albumsStatus,
    albumId,
    trackId,
    lang,
    currentTime.duration,
    currentTrackId,
    lastTextHash,
  ]);

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

        // Если устанавливаем startTime, автоматически устанавливаем/обновляем endTime предыдущей строки
        if (field === 'startTime' && lineIndex > 0) {
          const prevLine = newLines[lineIndex - 1];
          // Всегда обновляем endTime предыдущей строки на новый startTime,
          // чтобы избежать перекрытий и обеспечить последовательность
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

    // Загружаем авторство для передачи в сохранение (но не редактируем его здесь)
    const storedAuthorship = loadAuthorshipFromStorage(albumId, trackId, lang);

    // Получаем трек для получения авторства из JSON
    let trackAuthorship = '';
    if (album) {
      const track = album.tracks.find((t) => String(t.id) === trackId);
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

    console.log('💾 Сохранение синхронизаций:', {
      albumId,
      trackId,
      lang,
      linesCount: linesToSave.length,
      syncedLines: linesToSave,
      authorship: trackAuthorship.trim() || undefined,
    });

    const result = await saveSyncedLyrics({
      albumId,
      trackId,
      lang,
      syncedLyrics: linesToSave,
      authorship: trackAuthorship.trim() || undefined,
    });

    console.log('💾 Результат сохранения:', result);

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

      // Обновляем хэш текста, чтобы предотвратить повторную инициализацию
      const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
      const storedAuthorship = loadAuthorshipFromStorage(albumId, trackId, lang);
      const textToUse = storedText || '';
      const newHash = `${textToUse}-${storedAuthorship || ''}`;
      setLastTextHash(newHash);

      setIsDirty(false);
      setIsSaved(true);
    } else {
      setIsSaved(false);
      alert(`❌ Ошибка сохранения: ${result.message || 'Неизвестная ошибка'}`);
    }
  }, [albumId, trackId, lang, syncedLines, album, currentTime.duration]);

  // Ref для контейнера audio элемента
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  // Прикрепляем audio элемент к DOM при монтировании
  useEffect(() => {
    if (audioContainerRef.current && !audioContainerRef.current.contains(audioController.element)) {
      audioContainerRef.current.appendChild(audioController.element);
    }
  }, []);

  // Duration обновляется автоматически через глобальный обработчик loadedmetadata в playerListeners.ts
  // Не нужно дублировать логику здесь

  // Форматирование времени для отображения (MM:SS)
  const formatTimeCompact = useCallback((seconds: number) => {
    if (isNaN(seconds) || !Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Ref для прямого доступа к контейнеру времени и прогресс-бару
  const timeContainerRef = useRef<HTMLDivElement | null>(null);
  const progressInputRef = useRef<HTMLInputElement | null>(null);
  const currentTimeRef = useRef<HTMLSpanElement | null>(null);
  const remainingTimeRef = useRef<HTMLSpanElement | null>(null);

  // Используем useLayoutEffect с flushSync для принудительной синхронизации обновлений
  // Обновляем два отдельных элемента через textContent в одном синхронном блоке
  // flushSync гарантирует, что оба элемента обновятся синхронно до следующего рендера
  useLayoutEffect(() => {
    if (currentTimeRef.current && remainingTimeRef.current) {
      // Вычисляем значения напрямую из time
      const currentValue = formatTimeCompact(time.current);
      const remainingValue = formatTimeCompact(time.duration - time.current);

      // Используем flushSync для принудительной синхронизации обновлений
      // Это гарантирует, что оба элемента обновятся синхронно до следующего рендера
      flushSync(() => {
        currentTimeRef.current!.textContent = currentValue;
        remainingTimeRef.current!.textContent = remainingValue;
      });
    }
  }, [time, formatTimeCompact]);

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

  // Обработка изменения прогресс-бара (как в AudioPlayer)
  const handleProgressChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const duration = time.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      const value = Number(event.target.value);
      const newTime = (value / 100) * duration;

      dispatch(playerActions.setSeeking(true));
      // ЯВНО устанавливаем время в audio элементе сразу, не дожидаясь middleware
      // Это гарантирует, что аудио перематывается немедленно при клике на слайдер
      audioController.setCurrentTime(newTime);
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration }));
      dispatch(playerActions.setProgress(value));
      if (progressInputRef.current) {
        progressInputRef.current.style.setProperty('--progress-width', `${value}%`);
      }
    },
    [dispatch, time.duration]
  );

  // Обработчик окончания перемотки (как в AudioPlayer)
  const handleSeekEnd = useCallback(() => {
    // Снимаем флаг isSeeking (разрешает автообновление прогресса)
    dispatch(playerActions.setSeeking(false));
    if (isPlaying) {
      dispatch(playerActions.play());
    }
  }, [dispatch, isPlaying]);

  // Данные загружаются через loader

  if (albumsStatus === 'loading' || albumsStatus === 'idle') {
    return (
      <section className="admin-sync main-background" aria-label="Синхронизация текста">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  if (albumsStatus === 'failed') {
    return (
      <section className="admin-sync main-background" aria-label="Синхронизация текста">
        <div className="wrapper">
          <ErrorMessage error={albumsError || 'Не удалось загрузить данные трека'} />
        </div>
      </section>
    );
  }

  if (!album) {
    return (
      <section className="admin-sync main-background" aria-label="Синхронизация текста">
        <div className="wrapper">
          <ErrorMessage error={`Альбом "${albumId}" не найден`} />
        </div>
      </section>
    );
  }

  const track = album.tracks.find((t) => String(t.id) === trackId);

  if (!track) {
    return (
      <section className="admin-sync main-background" aria-label="Синхронизация текста">
        <div className="wrapper">
          <ErrorMessage
            error={`Трек #${trackId} не найден в альбоме "${album.album}". Доступные треки: ${album.tracks.map((t) => `${t.id} - ${t.title}`).join(', ')}`}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="admin-sync main-background" aria-label="Синхронизация текста">
      <div className="wrapper">
        <Breadcrumb
          items={[
            { label: 'К альбомам', to: '/admin' },
            { label: album.album, to: `/admin/album/${albumId}` },
          ]}
        />
        <div className="admin-sync__header">
          <h1>Синхронизация текста</h1>
          <p className="admin-sync__description">
            Запустите трек и нажимайте кнопки с временем рядом со строками, когда они начинают
            звучать. Конец строки устанавливается автоматически при установке начала следующей. Если
            нужно создать паузу между строками (заглушка в виде троеточия), установите конец
            предыдущей строки раньше начала следующей или начните первую строку не с нуля. Не
            забудьте сохранить синхронизацию после завершения.
          </p>
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
              <div className="admin-sync__player-progress-bar">
                <input
                  ref={progressInputRef}
                  type="range"
                  value={progress}
                  min="0"
                  max="100"
                  onChange={handleProgressChange}
                  onInput={handleProgressChange}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  aria-label="Прогресс воспроизведения"
                />
              </div>
              {/* Время: текущее и оставшееся */}
              {/* Используем два отдельных элемента для атомарного обновления через textContent */}
              <div className="admin-sync__player-time" ref={timeContainerRef}>
                <span ref={currentTimeRef}>{formatTimeCompact(time.current)}</span>
                <span ref={remainingTimeRef}>
                  {formatTimeCompact(time.duration - time.current)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Список строк с тайм-кодами */}
        <div className="admin-sync__lines">
          {isLoading || syncedLines.length === 0 ? (
            <div className="admin-sync__loading">
              <Loader />
            </div>
          ) : (
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
                    <div className="admin-sync__line-end">
                      <button
                        type="button"
                        onClick={() => setLineTime(index, 'endTime')}
                        className="admin-sync__time-btn"
                        disabled={currentTime.current === 0 && !isPlaying}
                      >
                        {formatTime(line.endTime ?? 0)}
                      </button>
                      <button
                        type="button"
                        onClick={() => clearEndTime(index)}
                        className="admin-sync__time-btn admin-sync__time-btn--clear"
                        title="Сбросить конец строки"
                        disabled={line.endTime === undefined || line.endTime === 0}
                      >
                        ✖️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка сохранения вынесена за пределы блока строк */}
        {!isLoading && syncedLines.length > 0 && (
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
              <span className="admin-sync__dirty-indicator">Есть несохранённые изменения</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
