import { useMemo } from 'react';
import type { SyncedLyricsLine } from '@models';
import type { PlayerTimeState } from '@features/player/model/types/playerSchema';

interface UseCurrentLineIndexParams {
  syncedLyrics: SyncedLyricsLine[] | null;
  time: PlayerTimeState;
  isPlaying: boolean;
  suppressActiveLineRef: React.MutableRefObject<boolean>;
}

/**
 * Хук для вычисления индекса текущей активной строки на основе времени воспроизведения
 */
export function useCurrentLineIndex({
  syncedLyrics,
  time,
  isPlaying,
  suppressActiveLineRef,
}: UseCurrentLineIndexParams) {
  const currentLineIndexComputed = useMemo(() => {
    if (!syncedLyrics || syncedLyrics.length === 0) {
      return null;
    }

    if (suppressActiveLineRef.current) {
      return null;
    }

    const timeValue = time.current;
    const lines = syncedLyrics;
    const firstLineStart = lines[0]?.startTime ?? 0;

    if (!isPlaying && timeValue <= firstLineStart + 0.05) {
      return null;
    }

    // Находим текущую строку: ищем строку, где time >= startTime и time < endTime
    let activeIndex: number | null = null;

    // Если время меньше startTime первой строки - нет активной строки (промежуток без текста в начале)
    if (lines.length > 0 && timeValue < lines[0].startTime) {
      activeIndex = null;
    } else {
      // Ищем активную строку среди всех строк
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];

        // Определяем границу окончания строки
        // Если endTime задан - используем его, иначе используем startTime следующей строки (или Infinity для последней)
        const lineEndTime =
          line.endTime !== undefined ? line.endTime : nextLine ? nextLine.startTime : Infinity;

        // Если время попадает в диапазон текущей строки
        // ВАЖНО: если endTime === startTime следующей строки, в момент t = endTime активна должна быть следующая строка
        // Поэтому для текущей строки используем строгое < для endTime
        if (timeValue >= line.startTime && timeValue < lineEndTime) {
          activeIndex = i;
          break;
        }

        // Специальная обработка: если endTime текущей строки === startTime следующей,
        // и время равно этому значению, то активна должна быть следующая строка
        // (это обработается на следующей итерации цикла)

        // Если это последняя строка
        if (!nextLine) {
          // Если время больше startTime последней строки - оставляем её активной
          // (даже если время прошло endTime - показываем последнюю строку до конца трека)
          if (timeValue >= line.startTime) {
            activeIndex = i;
            break;
          }
          // Если время меньше startTime последней строки - не устанавливаем активную строку
          break;
        }

        // Если есть следующая строка и время между текущей и следующей
        if (
          line.endTime !== undefined &&
          timeValue >= line.endTime &&
          timeValue < nextLine.startTime
        ) {
          // Промежуток между строками - показываем предыдущую (если она была и время в её диапазоне)
          if (i > 0) {
            const prevLine = lines[i - 1];
            if (
              timeValue >= prevLine.startTime &&
              (prevLine.endTime === undefined || timeValue < prevLine.endTime)
            ) {
              activeIndex = i - 1;
            }
          }
          break;
        }
      }
    }

    return activeIndex;
  }, [syncedLyrics, time, isPlaying, suppressActiveLineRef]);

  return currentLineIndexComputed;
}
