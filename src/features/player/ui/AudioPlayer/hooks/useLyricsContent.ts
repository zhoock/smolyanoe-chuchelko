import { useEffect, useLayoutEffect, useRef } from 'react';
import type { SyncedLyricsLine, TracksProps } from '@models';
import { loadSyncedLyricsFromStorage, loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import { loadTrackTextFromDatabase } from '@entities/track/lib';
import { debugLog } from '../utils/debug';

interface UseLyricsContentParams {
  currentTrack: TracksProps | null;
  albumId: string;
  lang: string;
  duration: number;
  setSyncedLyrics: React.Dispatch<React.SetStateAction<SyncedLyricsLine[] | null>>;
  setPlainLyricsContent: React.Dispatch<React.SetStateAction<string | null>>;
  setAuthorshipText: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentLineIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setIsLoadingSyncedLyrics: React.Dispatch<React.SetStateAction<boolean>>;
  setHasSyncedLyricsAvailable: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Проверяет синхронно наличие синхронизированного текста
 */
function checkSyncedLyricsAvailableSync(
  currentTrack: TracksProps | null,
  albumId: string,
  lang: string
): boolean {
  if (!currentTrack) {
    return false;
  }

  // Проверяем синхронно наличие в currentTrack
  if (currentTrack.syncedLyrics && currentTrack.syncedLyrics.length > 0) {
    const isActuallySynced = currentTrack.syncedLyrics.some((line) => line.startTime > 0);
    if (isActuallySynced) {
      return true;
    }
  }

  return false;
}

/**
 * Хук для загрузки контента lyrics (синхронизированный текст, обычный текст, авторство)
 */
export function useLyricsContent({
  currentTrack,
  albumId,
  lang,
  duration,
  setSyncedLyrics,
  setPlainLyricsContent,
  setAuthorshipText,
  setCurrentLineIndex,
  setIsLoadingSyncedLyrics,
  setHasSyncedLyricsAvailable,
}: UseLyricsContentParams) {
  // ✅ ВАЖНО: Ref для отслеживания текущего трека и проверки актуальности данных
  const currentTrackRef = useRef<{ id: string; albumId: string; lang: string } | null>(null);
  const requestIdRef = useRef(0);

  // ✅ СИНХРОННАЯ ОЧИСТКА ПРИ ПЕРЕКЛЮЧЕНИИ ТРЕКА (до paint)
  // Это предотвращает показ старого текста на несколько секунд
  useLayoutEffect(() => {
    const trackKey = currentTrack ? `${albumId}::${currentTrack.id}::${lang}` : null;
    const prevKey = currentTrackRef.current
      ? `${currentTrackRef.current.albumId}::${currentTrackRef.current.id}::${currentTrackRef.current.lang}`
      : null;

    // Если трек изменился - мгновенно очищаем состояние ДО загрузки новых данных
    if (trackKey !== prevKey) {
      // Инвалидируем все pending запросы
      requestIdRef.current += 1;

      // Мгновенно очищаем UI (синхронно, до paint)
      setSyncedLyrics(null);
      setAuthorshipText(null);
      setCurrentLineIndex(null);
      setPlainLyricsContent(null);
      setIsLoadingSyncedLyrics(true);

      // Обновляем ref
      if (currentTrack) {
        currentTrackRef.current = {
          id: String(currentTrack.id),
          albumId,
          lang,
        };
      } else {
        currentTrackRef.current = null;
      }
    }
  }, [
    currentTrack,
    albumId,
    lang,
    setSyncedLyrics,
    setAuthorshipText,
    setCurrentLineIndex,
    setPlainLyricsContent,
    setIsLoadingSyncedLyrics,
  ]);

  // Синхронно проверяем наличие синхронизированного текста
  useEffect(() => {
    const hasSynced = checkSyncedLyricsAvailableSync(currentTrack, albumId, lang);
    setHasSyncedLyricsAvailable(hasSynced);
  }, [currentTrack, albumId, lang, setHasSyncedLyricsAvailable]);

  // Загружаем синхронизации для текущего трека
  useEffect(() => {
    if (!currentTrack) {
      setIsLoadingSyncedLyrics(false);
      return;
    }

    // Вычисляем albumId
    const albumIdComputed = albumId;
    const trackId = currentTrack.id;

    // Создаем уникальный ID для этого запроса
    const currentRequestId = ++requestIdRef.current;
    const isRequestValid = () => {
      // Проверяем, что трек не изменился с момента начала запроса
      const currentKey = `${albumIdComputed}::${String(trackId)}::${lang}`;
      const refKey = currentTrackRef.current
        ? `${currentTrackRef.current.albumId}::${currentTrackRef.current.id}::${currentTrackRef.current.lang}`
        : null;
      return currentRequestId === requestIdRef.current && currentKey === refKey;
    };

    // Устанавливаем состояние загрузки
    setIsLoadingSyncedLyrics(true);

    // Загружаем синхронизации асинхронно
    (async () => {
      try {
        if (!isRequestValid()) return;

        const storedSync = await loadSyncedLyricsFromStorage(albumIdComputed, trackId, lang);

        if (!isRequestValid()) return;

        const baseSynced: SyncedLyricsLine[] | null | undefined =
          storedSync || currentTrack.syncedLyrics;

        if (baseSynced && baseSynced.length > 0) {
          // Проверяем, действительно ли текст синхронизирован
          // Если все строки имеют startTime: 0, это обычный текст (не синхронизированный)
          const isActuallySynced = baseSynced.some((line) => line.startTime > 0);

          if (isActuallySynced) {
            if (!isRequestValid()) return;

            // Текст действительно синхронизирован - загружаем авторство и добавляем его в конец
            const storedAuthorship = await loadAuthorshipFromStorage(
              albumIdComputed,
              trackId,
              lang
            );

            if (!isRequestValid()) return;

            const authorship = currentTrack.authorship || storedAuthorship;

            const synced = [...baseSynced];

            // Добавляем авторство в конец, если оно есть и ещё не добавлено
            if (authorship) {
              const lastLine = synced[synced.length - 1];
              // Проверяем, не является ли последняя строка уже авторством
              if (!lastLine || lastLine.text !== authorship) {
                synced.push({
                  text: authorship,
                  startTime: duration || 0,
                  endTime: undefined,
                });
              }
            }

            if (isRequestValid()) {
              setSyncedLyrics(synced);
              setAuthorshipText(authorship || null);
            }
          } else {
            // Текст не синхронизирован (все строки имеют startTime: 0) - не показываем как синхронизированный
            // Он будет отображаться как обычный текст через plainLyricsContent
            if (isRequestValid()) {
              setSyncedLyrics(null);
              setAuthorshipText(null);
              setCurrentLineIndex(null);
            }
          }
        } else {
          if (isRequestValid()) {
            setSyncedLyrics(null);
            setAuthorshipText(null);
            setCurrentLineIndex(null);
          }
        }
      } finally {
        if (isRequestValid()) {
          setIsLoadingSyncedLyrics(false);
        }
      }
    })();
  }, [
    currentTrack,
    albumId,
    lang,
    duration,
    setSyncedLyrics,
    setAuthorshipText,
    setCurrentLineIndex,
    setIsLoadingSyncedLyrics,
  ]);

  // Загружаем обычный текст (не синхронизированный) из БД или JSON
  useEffect(() => {
    if (!currentTrack) {
      setPlainLyricsContent(null);
      return;
    }

    const albumIdComputed = albumId;
    const trackId = currentTrack.id;

    // Создаем уникальный ID для этого запроса
    const currentRequestId = ++requestIdRef.current;
    const isRequestValid = () => {
      // Проверяем, что трек не изменился с момента начала запроса
      const currentKey = `${albumIdComputed}::${String(trackId)}::${lang}`;
      const refKey = currentTrackRef.current
        ? `${currentTrackRef.current.albumId}::${currentTrackRef.current.id}::${currentTrackRef.current.lang}`
        : null;
      return currentRequestId === requestIdRef.current && currentKey === refKey;
    };

    const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

    // Сначала проверяем текст из JSON (синхронно)
    if (currentTrack.content && currentTrack.content.trim().length > 0) {
      if (isRequestValid()) {
        setPlainLyricsContent(normalize(currentTrack.content));
      }
      return;
    }

    // Затем проверяем localStorage (dev mode) - синхронно
    const storedContentKey = `karaoke-text:${albumIdComputed}:${trackId}:${lang}`;

    try {
      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem(storedContentKey) : null;
      if (stored && stored.trim().length > 0) {
        if (isRequestValid()) {
          setPlainLyricsContent(normalize(stored));
        }
        return;
      }
    } catch (error) {
      debugLog('Cannot read stored text content', { error });
    }

    // Если текст не найден в JSON и localStorage, загружаем из БД (асинхронно)
    (async () => {
      const textFromDb = await loadTrackTextFromDatabase(albumIdComputed, trackId, lang);
      if (isRequestValid()) {
        if (textFromDb && textFromDb.trim().length > 0) {
          setPlainLyricsContent(normalize(textFromDb));
        } else {
          setPlainLyricsContent(null);
        }
      }
    })();
  }, [currentTrack, albumId, lang, setPlainLyricsContent]);
}
