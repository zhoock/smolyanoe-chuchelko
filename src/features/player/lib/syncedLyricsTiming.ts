import type { SyncedLyricsLine } from '@models';

/**
 * Конец интервала строки для караоке. Если `endTime` не задан, берём время начала
 * следующей строки с **строго большим** `startTime`, пропуская «нулевые» хвосты
 * незасинхроненных строк после остановки разметки — иначе `nextLine.startTime === 0`
 * даёт пустой интервал [t, 0) и подсветка «перепрыгивает» на следующую строку с тем же t.
 */
export function getSyncedLineEndTime(lines: SyncedLyricsLine[], i: number): number {
  const line = lines[i];
  if (line.endTime !== undefined && Number.isFinite(line.endTime)) {
    return line.endTime;
  }
  const start = line.startTime ?? 0;
  let j = i + 1;
  while (j < lines.length) {
    const nextStart = lines[j].startTime ?? 0;
    if (nextStart > start) {
      return nextStart;
    }
    j += 1;
  }
  return Infinity;
}
