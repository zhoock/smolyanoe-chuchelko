import type { RecordingEntry } from './EditAlbumModal.types';

/** Сравнивает поля редактирования записи (Recorded / Mixed / Mastered) с сохранённой записью. */
export function recordingEntryEditHasChanges(
  entry: RecordingEntry,
  parsed: { dateFrom?: string; dateTo?: string; studioText?: string },
  dateFrom: string,
  dateTo: string,
  studioText: string,
  city: string,
  url: string
): boolean {
  const norm = (s: string | undefined) => (s ?? '').trim();
  const normUrl = (s: string | undefined) => {
    const t = norm(s);
    return t || undefined;
  };
  const baseFrom = norm(entry.dateFrom || parsed.dateFrom || '');
  const baseTo = norm(entry.dateTo || parsed.dateTo || '');
  const baseStudio = norm(entry.studioText || parsed.studioText || '');
  const baseCity = norm(entry.city || '');
  const baseUrl = normUrl(entry.url);

  return (
    norm(dateFrom) !== baseFrom ||
    norm(dateTo) !== baseTo ||
    norm(studioText) !== baseStudio ||
    norm(city) !== baseCity ||
    normUrl(url) !== baseUrl
  );
}
