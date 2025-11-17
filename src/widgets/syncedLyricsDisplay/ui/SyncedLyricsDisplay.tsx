// src/widgets/syncedLyricsDisplay/ui/SyncedLyricsDisplay.tsx
/**
 * Компонент для отображения синхронизированного текста песни (karaoke-style).
 * Используется в попапе с плеером для отображения текста под плеером.
 * Автоматически подсвечивает текущую строку на основе времени воспроизведения.
 */
import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { playerSelectors } from '@features/player';
import { loadSyncedLyricsFromStorage } from '@features/syncedLyrics/lib';
import type { SyncedLyricsLine, IAlbums } from '@models';
import { useLang } from '@app/providers/lang';
import './style.scss';

interface SyncedLyricsDisplayProps {
  album: IAlbums; // Данные об альбоме (для получения трека)
}

export function SyncedLyricsDisplay({ album }: SyncedLyricsDisplayProps) {
  const { lang } = useLang();

  // Получаем данные из Redux плеера
  const currentTrackIndex = useAppSelector(playerSelectors.selectCurrentTrackIndex);
  const currentTime = useAppSelector(playerSelectors.selectTime);
  const playlist = useAppSelector(playerSelectors.selectPlaylist);

  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyricsLine[] | null>(null);

  // Refs для автоскролла
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Получаем текущий трек из плейлиста
  const currentTrack = playlist[currentTrackIndex];

  // Загружаем синхронизации для текущего трека
  useEffect(() => {
    if (!currentTrack) {
      setSyncedLyrics(null);
      setCurrentLineIndex(null);
      return;
    }

    // Вычисляем albumId
    const albumId =
      album.albumId ?? `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

    // Загружаем синхронизации асинхронно
    (async () => {
      const storedSync = await loadSyncedLyricsFromStorage(albumId, currentTrack.id, lang);
      const synced = storedSync || currentTrack.syncedLyrics;

      if (synced && synced.length > 0) {
        setSyncedLyrics(synced);
      } else {
        setSyncedLyrics(null);
        setCurrentLineIndex(null);
      }
    })();
  }, [currentTrack, album, lang]);

  // Определяем текущую строку на основе времени воспроизведения
  useEffect(() => {
    if (!syncedLyrics || syncedLyrics.length === 0) {
      setCurrentLineIndex(null);
      return;
    }

    const time = currentTime.current;
    const lines = syncedLyrics;

    // Находим текущую строку: ищем строку, где time >= startTime и time < endTime
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

      // Если это последняя строка
      if (!nextLine) {
        // Если время больше startTime последней строки - оставляем её активной
        // (даже если время прошло endTime - показываем последнюю строку до конца трека)
        if (time >= line.startTime) {
          activeIndex = i;
          break;
        }
        // Если время меньше startTime последней строки - ищем предыдущие
        break;
      }

      // Если есть следующая строка и время между текущей и следующей
      if (line.endTime !== undefined && time >= line.endTime && time < nextLine.startTime) {
        // Промежуток между строками - показываем предыдущую (если она была и время в её диапазоне)
        if (i > 0) {
          const prevLine = lines[i - 1];
          if (
            time >= prevLine.startTime &&
            (prevLine.endTime === undefined || time < prevLine.endTime)
          ) {
            activeIndex = i - 1;
          }
        }
        break;
      }
    }

    setCurrentLineIndex(activeIndex);
  }, [syncedLyrics, currentTime]);

  // Автоскролл к активной строке
  // Более мягкая логика: скроллим только если строка действительно не видна, с минимальным отступом
  useEffect(() => {
    if (currentLineIndex === null || !lyricsContainerRef.current) return;

    const lineElement = lineRefs.current.get(currentLineIndex);
    if (!lineElement) return;

    const container = lyricsContainerRef.current;
    const lineTop = lineElement.offsetTop;
    const lineHeight = lineElement.offsetHeight;
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;

    // Минимальный отступ сверху (примерно 10% высоты контейнера или 40px, что меньше)
    const topOffset = Math.min(containerHeight * 0.1, 40);
    // Отступ снизу (тоже минимальный)
    const bottomOffset = Math.min(containerHeight * 0.1, 40);

    // Проверяем, видна ли строка в видимой области (с небольшими отступами сверху и снизу)
    const lineTopVisible = lineTop >= scrollTop + topOffset;
    const lineBottomVisible = lineTop + lineHeight <= scrollTop + containerHeight - bottomOffset;
    const isFullyVisible = lineTopVisible && lineBottomVisible;

    // Скроллим только если строка действительно не видна
    if (!isFullyVisible) {
      // Определяем, нужно ли скроллить вверх или вниз
      if (lineTop < scrollTop + topOffset) {
        // Строка слишком высоко - скроллим вверх с небольшим отступом
        container.scrollTo({
          top: Math.max(0, lineTop - topOffset),
          behavior: 'smooth',
        });
      } else if (lineTop + lineHeight > scrollTop + containerHeight - bottomOffset) {
        // Строка слишком низко - скроллим вниз, чтобы она была видна с отступом снизу
        const targetScroll = lineTop + lineHeight - containerHeight + bottomOffset;
        container.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: 'smooth',
        });
      }
    }
  }, [currentLineIndex]);

  // Если нет трека или синхронизаций - не отображаем ничего
  if (!currentTrack || !syncedLyrics || syncedLyrics.length === 0) {
    return null;
  }

  return (
    <div className="synced-lyrics-display">
      <div className="synced-lyrics-display__container" ref={lyricsContainerRef}>
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
              className={`synced-lyrics-display__line ${isActive ? 'synced-lyrics-display__line--active' : ''}`}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
