// src/widgets/tracksLyrics/ui/TracksLyrics.tsx
/**
 * Компонент для отображения текста песни.
 * Поддерживает два режима:
 * 1. Обычный текст (track.content) - для треков без синхронизации
 * 2. Синхронизированный текст (track.syncedLyrics) - karaoke-style с подсветкой текущей строки
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAlbumsData } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerSelectors } from '@features/player';
import {
  loadSyncedLyricsFromStorage,
  loadAuthorshipFromStorage,
} from '../../../utils/syncedLyrics';
import type { SyncedLyricsLine } from '../../../models';
import './style.scss';

export const TracksLyrics = () => {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '', trackId = '' } = useParams<{ albumId: string; trackId: string }>();

  // Получаем текущее время из Redux плеера для синхронизации
  const currentTime = useAppSelector(playerSelectors.selectTime);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);

  // Refs для автоскролла
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Определяем текущую строку на основе времени воспроизведения
  useEffect(() => {
    if (!data) return;

    data.templateA.then((albums) => {
      const album = albums.find((a) => a.albumId === albumId);
      const track = album?.tracks.find((t) => String(t.id) === trackId);

      if (!track) {
        setCurrentLineIndex(null);
        return;
      }

      // Загружаем синхронизации из localStorage (dev mode) или используем из JSON
      const storedSync = loadSyncedLyricsFromStorage(albumId, track.id, lang);
      const baseSyncedLyrics = storedSync || track.syncedLyrics;

      if (!baseSyncedLyrics || baseSyncedLyrics.length === 0) {
        setCurrentLineIndex(null);
        return;
      }

      // Загружаем авторство и добавляем его в конец, если оно есть
      const storedAuthorship = loadAuthorshipFromStorage(albumId, track.id, lang);
      const authorship = track.authorship || storedAuthorship;

      const syncedLyrics = [...baseSyncedLyrics];
      // Добавляем авторство в конец, если оно есть и ещё не добавлено
      if (authorship) {
        const lastLine = syncedLyrics[syncedLyrics.length - 1];
        if (!lastLine || lastLine.text !== authorship) {
          syncedLyrics.push({
            text: authorship,
            startTime: currentTime.duration || 0,
            endTime: undefined,
          });
        }
      }

      const time = currentTime.current;
      const lines = syncedLyrics;

      // Находим текущую строку: ищем строку, где time >= startTime и time < endTime (или следующая строка ещё не началась)
      let activeIndex: number | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        // Определяем границу окончания строки
        // Если endTime задан - используем его, иначе используем startTime следующей строки (или Infinity для последней)
        const lineEndTime =
          line.endTime !== undefined ? line.endTime : nextLine ? nextLine.startTime : Infinity;

        // Если время попадает в диапазон текущей строки
        if (time >= line.startTime && time < lineEndTime) {
          activeIndex = i;
          break;
        }

        // Если есть следующая строка и время между текущей и следующей
        if (
          nextLine &&
          line.endTime !== undefined &&
          time >= line.endTime &&
          time < nextLine.startTime
        ) {
          // Промежуток между строками - показываем предыдущую (если она была)
          if (i > 0 && time >= lines[i - 1].startTime) {
            activeIndex = i - 1;
          }
          break;
        }

        // Если это последняя строка и время больше её startTime
        if (!nextLine && time >= line.startTime) {
          activeIndex = i;
          break;
        }
      }

      setCurrentLineIndex(activeIndex);
    });
  }, [data, albumId, trackId, lang, currentTime.current]);

  // Автоскролл к активной строке
  // Более мягкая логика: скроллим только если строка совсем не видна, с небольшим отступом сверху
  useEffect(() => {
    if (currentLineIndex === null) return;

    const lineElement = lineRefs.current.get(currentLineIndex);
    if (!lineElement || !lyricsContainerRef.current) return;

    const container = lyricsContainerRef.current;
    const lineTop = lineElement.offsetTop;
    const lineHeight = lineElement.offsetHeight;
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;

    // Небольшой отступ сверху (примерно 1/4 высоты контейнера)
    const topOffset = containerHeight * 0.25;

    // Проверяем, полностью ли видна строка (с небольшим запасом)
    const isFullyVisible =
      lineTop >= scrollTop + topOffset &&
      lineTop + lineHeight <= scrollTop + containerHeight - topOffset;

    // Скроллим только если строка совсем не видна или слишком близко к краям
    if (!isFullyVisible) {
      // Скроллим так, чтобы строка была видна с отступом сверху (не в самый центр)
      const targetScroll = lineTop - topOffset;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [currentLineIndex]);

  if (!data) {
    return (
      <>
        <pre>
          <h2 className="track-lyrics">…</h2>
        </pre>
        <pre>…</pre>
      </>
    );
  }

  return (
    <DataAwait
      value={data.templateA}
      fallback={
        <>
          <pre>
            <h2 className="track-lyrics">
              <Loader />
            </h2>
          </pre>
          <pre>…</pre>
        </>
      }
      error={<ErrorMessage error="Не удалось загрузить текст трека" />}
    >
      {(albums) => {
        const album = albums.find((a) => a.albumId === albumId);
        const track = album?.tracks.find((t) => String(t.id) === trackId);

        if (!album || !track) {
          return <ErrorMessage error="Трек не найден" />;
        }

        // Загружаем синхронизации из localStorage (dev mode) или используем из JSON
        const storedSync = loadSyncedLyricsFromStorage(albumId, track.id, lang);
        const baseSyncedLyrics = storedSync || track.syncedLyrics;

        // Загружаем авторство и добавляем его в конец, если оно есть
        const storedAuthorship = loadAuthorshipFromStorage(albumId, track.id, lang);
        const authorship = track.authorship || storedAuthorship;

        const syncedLyrics = [...(baseSyncedLyrics || [])];
        // Добавляем авторство в конец, если оно есть и ещё не добавлено
        if (authorship) {
          const lastLine = syncedLyrics[syncedLyrics.length - 1];
          if (!lastLine || lastLine.text !== authorship) {
            syncedLyrics.push({
              text: authorship,
              startTime: currentTime.duration || 0,
              endTime: undefined,
            });
          }
        }

        // Если есть синхронизированный текст - отображаем его в karaoke-стиле
        if (syncedLyrics && syncedLyrics.length > 0) {
          return (
            <>
              <pre>
                <h2 className="track-lyrics">{track.title}</h2>
              </pre>
              <div className="synced-lyrics" ref={lyricsContainerRef}>
                {syncedLyrics.map((line: SyncedLyricsLine, index: number) => {
                  const isActive = currentLineIndex === index;
                  return (
                    <div
                      key={index}
                      ref={(el) => {
                        if (el) {
                          lineRefs.current.set(index, el);
                        } else {
                          lineRefs.current.delete(index);
                        }
                      }}
                      className={`synced-lyrics__line ${isActive ? 'synced-lyrics__line--active' : ''} ${authorship && line.text === authorship ? 'synced-lyrics__line--authorship' : ''}`}
                    >
                      {authorship && line.text === authorship
                        ? `Авторство: ${line.text}`
                        : line.text}
                    </div>
                  );
                })}
              </div>
            </>
          );
        }

        // Иначе отображаем обычный текст
        return (
          <>
            <pre>
              <h2 className="track-lyrics">{track.title}</h2>
            </pre>
            <pre>{track.content}</pre>
          </>
        );
      }}
    </DataAwait>
  );
};
