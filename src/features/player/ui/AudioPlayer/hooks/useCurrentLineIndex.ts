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
    if (lines.length === 0 || timeValue < lines[0].startTime) {
      return null;
    }

    // Ищем активную строку среди всех строк
    // Проходим по всем строкам и находим первую строку, в диапазон которой попадает текущее время
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];

      // Определяем границу окончания строки
      // Если endTime задан - используем его, иначе используем startTime следующей строки (или Infinity для последней)
      let lineEndTime: number;
      if (line.endTime !== undefined) {
        lineEndTime = line.endTime;
      } else if (nextLine) {
        lineEndTime = nextLine.startTime;
      } else {
        // Последняя строка без endTime - активна до конца трека
        lineEndTime = Infinity;
      }

      // Проверяем, попадает ли время в диапазон текущей строки
      // ВАЖНО: используем строгое < для endTime, чтобы при равенстве времени и endTime активной была следующая строка
      if (timeValue >= line.startTime && timeValue < lineEndTime) {
        activeIndex = i;
        break; // Нашли активную строку, выходим из цикла
      }

      // Если это последняя строка и мы дошли сюда, значит время >= lineEndTime
      // Для последней строки без endTime это может быть только если lineEndTime === Infinity
      // Но в этом случае условие выше должно было сработать
      // Для последней строки с endTime - если время >= endTime, то строка уже не активна
      if (!nextLine) {
        // Если это последняя строка и время >= startTime, но >= endTime
        // И endTime был Infinity (не был задан), то строка должна быть активна
        // Но это уже обработано выше
        // Если endTime был задан и время >= endTime, строка не активна
        break;
      }
    }

    return activeIndex;
  }, [syncedLyrics, time, isPlaying, suppressActiveLineRef]);

  return currentLineIndexComputed;
}
