/**
 * Порядок треков в альбоме хранится с шагом (10, 20, 30…), а не 1, 2, 3 —
 * так проще вставлять между элементами (например 25 между 20 и 30) и
 * реже сталкиваться с коллизиями при гонках, если сервер атомарно пересчитывает список.
 */
export const TRACK_ORDER_INDEX_STEP = 10;

/** Позиция в отсортированном списке 0..n-1 → значение для колонки order_index. */
export function rankToOrderIndex(rank: number): number {
  return (rank + 1) * TRACK_ORDER_INDEX_STEP;
}

/** Следующий индекс после текущего максимума в альбоме (добавление в конец). */
export function nextOrderIndexAfterMax(maxExisting: number): number {
  return maxExisting + TRACK_ORDER_INDEX_STEP;
}
