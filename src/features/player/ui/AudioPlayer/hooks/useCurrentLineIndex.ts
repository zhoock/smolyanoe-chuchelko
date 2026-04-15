import { useMemo } from 'react';
import type { SyncedLyricsLine } from '@models';
import type { PlayerTimeState } from '@features/player/model/types/playerSchema';
import { getSyncedLineEndTime } from '@features/player/lib/syncedLyricsTiming';

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
      const lineEndTime = getSyncedLineEndTime(lines, i);

      // Проверяем, попадает ли время в диапазон текущей строки
      // ВАЖНО: используем строгое < для endTime, чтобы при равенстве времени и endTime активной была следующая строка
      if (timeValue >= line.startTime && timeValue < lineEndTime) {
        activeIndex = i;
        break; // Нашли активную строку, выходим из цикла
      }

      if (!nextLine) {
        break;
      }
    }

    return activeIndex;
  }, [syncedLyrics, time, isPlaying, suppressActiveLineRef]);

  return currentLineIndexComputed;
}
