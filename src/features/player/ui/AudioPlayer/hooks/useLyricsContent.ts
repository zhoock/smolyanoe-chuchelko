import { useEffect } from 'react';
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
}: UseLyricsContentParams) {
  // Загружаем синхронизации для текущего трека
  useEffect(() => {
    if (!currentTrack) {
      setSyncedLyrics(null);
      setCurrentLineIndex(null);
      return;
    }

    // Вычисляем albumId
    const albumIdComputed = albumId;

    // Загружаем синхронизации асинхронно
    (async () => {
      const storedSync = await loadSyncedLyricsFromStorage(albumIdComputed, currentTrack.id, lang);
      const baseSynced: SyncedLyricsLine[] | null | undefined =
        storedSync || currentTrack.syncedLyrics;

      if (baseSynced && baseSynced.length > 0) {
        // Проверяем, действительно ли текст синхронизирован
        // Если все строки имеют startTime: 0, это обычный текст (не синхронизированный)
        const isActuallySynced = baseSynced.some((line) => line.startTime > 0);

        if (isActuallySynced) {
          // Текст действительно синхронизирован - загружаем авторство и добавляем его в конец
          const storedAuthorship = await loadAuthorshipFromStorage(
            albumIdComputed,
            currentTrack.id,
            lang
          );
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

          setSyncedLyrics(synced);
          setAuthorshipText(authorship || null);
        } else {
          // Текст не синхронизирован (все строки имеют startTime: 0) - не показываем как синхронизированный
          // Он будет отображаться как обычный текст через plainLyricsContent
          setSyncedLyrics(null);
          setAuthorshipText(null);
          setCurrentLineIndex(null);
        }
      } else {
        setSyncedLyrics(null);
        setAuthorshipText(null);
        setCurrentLineIndex(null);
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
  ]);

  // Загружаем обычный текст (не синхронизированный) из БД или JSON
  useEffect(() => {
    if (!currentTrack) {
      setPlainLyricsContent(null);
      return;
    }

    const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

    // Сначала проверяем текст из JSON
    if (currentTrack.content && currentTrack.content.trim().length > 0) {
      setPlainLyricsContent(normalize(currentTrack.content));
      return;
    }

    // Затем проверяем localStorage (dev mode)
    const albumIdComputed = albumId;
    const storedContentKey = `karaoke-text:${albumIdComputed}:${currentTrack.id}:${lang}`;

    try {
      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem(storedContentKey) : null;
      if (stored && stored.trim().length > 0) {
        setPlainLyricsContent(normalize(stored));
        return;
      }
    } catch (error) {
      debugLog('Cannot read stored text content', { error });
    }

    // Если текст не найден в JSON и localStorage, загружаем из БД
    (async () => {
      const textFromDb = await loadTrackTextFromDatabase(albumIdComputed, currentTrack.id, lang);
      if (textFromDb && textFromDb.trim().length > 0) {
        setPlainLyricsContent(normalize(textFromDb));
      } else {
        setPlainLyricsContent(null);
      }
    })();
  }, [currentTrack, albumId, lang, setPlainLyricsContent]);
}
