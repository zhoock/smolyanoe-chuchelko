/**
 * Уникальный фрагмент для имён загружаемых файлов (без коллизий в одну миллисекунду и при частых запросах).
 */
export function uniqueUploadFileSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
