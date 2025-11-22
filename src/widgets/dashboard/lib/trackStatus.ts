/**
 * Общие утилиты для работы со статусами треков в dashboard
 * Убирает дублирование кода между компонентами
 */

import { loadSyncedLyricsFromStorage } from '@features/syncedLyrics/lib';
import { loadTrackTextFromStorage } from '@entities/track/lib';

export type TrackStatus = 'synced' | 'text-only' | 'empty';

/**
 * Получает статус трека (синхронизирован, только текст, пусто)
 */
export async function getTrackStatus(
  albumId: string,
  trackId: string | number,
  lang: string,
  hasSyncedLyrics: boolean,
  signal?: AbortSignal
): Promise<TrackStatus> {
  // В production loadTrackTextFromStorage всегда возвращает null
  // Поэтому полагаемся только на API
  const storedSync = await loadSyncedLyricsFromStorage(albumId, trackId, lang, signal);

  if (hasSyncedLyrics || (storedSync && storedSync.length > 0)) {
    return 'synced';
  }

  // Проверяем текст только в dev режиме
  if (process.env.NODE_ENV === 'development') {
    const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
    if (storedText !== null) {
      return 'text-only';
    }
  }

  return 'empty';
}

/**
 * Обрабатывает массив элементов батчами для ограничения параллельных запросов
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  delayBetweenBatches: number = 0
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Задержка между батчами для снижения нагрузки на Supabase pooler
    if (delayBetweenBatches > 0 && i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }
  return results;
}
