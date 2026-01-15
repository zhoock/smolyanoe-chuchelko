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

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

function isActuallySynced(lines: SyncedLyricsLine[]) {
  return lines.some((l) => (l?.startTime ?? 0) > 0);
}

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
  // Актуальный ключ трека: по нему валидируем async-результаты
  const trackKeyRef = useRef<string | null>(null);

  const getTrackKey = () => {
    if (!currentTrack) return null;
    return `${albumId}::${String(currentTrack.id)}::${lang}`;
  };

  const isKeyActual = (key: string | null) => key !== null && key === trackKeyRef.current;

  // 1) СИНХРОННАЯ ОЧИСТКА при смене трека (до paint)
  useLayoutEffect(() => {
    const nextKey = getTrackKey();
    const prevKey = trackKeyRef.current;

    if (nextKey === prevKey) return;

    trackKeyRef.current = nextKey;

    // мгновенно очищаем UI
    setSyncedLyrics(null);
    setAuthorshipText(null);
    setCurrentLineIndex(null);
    setPlainLyricsContent(null);

    // включаем загрузку синхры, если трек есть
    setIsLoadingSyncedLyrics(!!currentTrack);

    // быстрый хинт: есть ли синхра прямо в currentTrack
    if (currentTrack?.syncedLyrics?.length) {
      setHasSyncedLyricsAvailable(isActuallySynced(currentTrack.syncedLyrics));
    } else {
      setHasSyncedLyricsAvailable(false);
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
    setHasSyncedLyricsAvailable,
  ]);

  // 2) Загрузка SYNCED lyrics (karaoke)
  useEffect(() => {
    const key = getTrackKey();
    if (!currentTrack || !key) {
      setIsLoadingSyncedLyrics(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 2.1 пробуем storage
        const storedSync = await loadSyncedLyricsFromStorage(albumId, currentTrack.id, lang);
        if (cancelled || !isKeyActual(key)) return;

        // уточняем hasSyncedLyricsAvailable по факту storage (важно для мобилки)
        if (storedSync && storedSync.length > 0 && isActuallySynced(storedSync)) {
          setHasSyncedLyricsAvailable(true);
        } else if (storedSync === null) {
          // ✅ ВАЖНО: если storage явно сказал "нет синхры" (null) — не показываем скелетон
          setHasSyncedLyricsAvailable(false);
        } else {
          // если storage пуст (undefined/ошибка), но в track есть синхра — оставим true
          const hint =
            currentTrack.syncedLyrics?.length && isActuallySynced(currentTrack.syncedLyrics);
          setHasSyncedLyricsAvailable(!!hint);
        }

        // 2.2 выбираем базовую синхру: storage или fallback из currentTrack (только если реально synced)
        let base: SyncedLyricsLine[] | null = null;

        if (storedSync && storedSync.length > 0 && isActuallySynced(storedSync)) {
          base = storedSync;
        } else if (
          // ✅ ВАЖНО: если storage явно сказал "нет синхры" (null) — не берём fallback из currentTrack
          storedSync !== null &&
          currentTrack.syncedLyrics?.length &&
          isActuallySynced(currentTrack.syncedLyrics)
        ) {
          base = currentTrack.syncedLyrics;
        }

        if (!base) {
          setSyncedLyrics(null);
          setAuthorshipText(null);
          setCurrentLineIndex(null);
          return;
        }

        // 2.3 авторство
        const storedAuthorship = await loadAuthorshipFromStorage(albumId, currentTrack.id, lang);
        if (cancelled || !isKeyActual(key)) return;

        const authorship = currentTrack.authorship || storedAuthorship || null;

        const synced = [...base];
        if (authorship) {
          const last = synced[synced.length - 1];
          if (!last || last.text !== authorship) {
            synced.push({
              text: authorship,
              startTime: Number.isFinite(duration) && duration > 0 ? duration : 0,
              endTime: undefined,
            });
          }
        }

        setSyncedLyrics(synced);
        setAuthorshipText(authorship);
      } catch (error) {
        debugLog('useLyricsContent: failed to load synced lyrics', { error });
        if (!cancelled && isKeyActual(key)) {
          setSyncedLyrics(null);
          setAuthorshipText(null);
          setCurrentLineIndex(null);
        }
      } finally {
        if (!cancelled && isKeyActual(key)) {
          setIsLoadingSyncedLyrics(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack,
    albumId,
    lang,
    duration,
    setSyncedLyrics,
    setAuthorshipText,
    setCurrentLineIndex,
    setIsLoadingSyncedLyrics,
    setHasSyncedLyricsAvailable,
  ]);

  // 3) Загрузка PLAIN lyrics (обычный текст)
  useEffect(() => {
    const key = getTrackKey();
    if (!currentTrack || !key) {
      setPlainLyricsContent(null);
      return;
    }

    let cancelled = false;

    // 3.1 сначала JSON
    if (currentTrack.content?.trim()) {
      if (!cancelled && isKeyActual(key)) {
        setPlainLyricsContent(normalize(currentTrack.content));
      }
      return () => {
        cancelled = true;
      };
    }

    // 3.2 затем localStorage (dev)
    const storedContentKey = `karaoke-text:${albumId}:${currentTrack.id}:${lang}`;
    try {
      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem(storedContentKey) : null;
      if (stored?.trim()) {
        if (!cancelled && isKeyActual(key)) {
          setPlainLyricsContent(normalize(stored));
        }
        return () => {
          cancelled = true;
        };
      }
    } catch (error) {
      debugLog('Cannot read stored text content', { error });
    }

    // 3.3 затем БД
    (async () => {
      try {
        const textFromDb = await loadTrackTextFromDatabase(albumId, currentTrack.id, lang);
        if (cancelled || !isKeyActual(key)) return;

        if (textFromDb?.trim()) {
          setPlainLyricsContent(normalize(textFromDb));
        } else {
          setPlainLyricsContent(null);
        }
      } catch (error) {
        debugLog('useLyricsContent: failed to load plain lyrics', { error });
        if (!cancelled && isKeyActual(key)) {
          setPlainLyricsContent(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, albumId, lang, setPlainLyricsContent]);
}
