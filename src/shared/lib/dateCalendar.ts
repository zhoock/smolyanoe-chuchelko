/**
 * Календарные даты YYYY-MM-DD без сдвига из-за часового пояса.
 * Не использовать `new Date('YYYY-MM-DD')` и `toISOString().split('T')[0]` для «сегодня» в браузере.
 */

const LEADING_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Сегодня / переданная дата как календарный день в локальной таймзоне клиента (YYYY-MM-DD). */
export function toLocalYYYYMMDD(source: Date = new Date()): string {
  const y = source.getFullYear();
  const m = String(source.getMonth() + 1).padStart(2, '0');
  const d = String(source.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUTCYYYYMMDD(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Разбор префикса YYYY-MM-DD как календарной даты (без времени и TZ). */
export function parseISODateOnlyParts(
  value: string
): { year: number; monthIndex: number; day: number } | null {
  const m = LEADING_ISO_DATE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return null;
  }
  return { year, monthIndex, day };
}

/**
 * Postgres DATE или строка даты из API → YYYY-MM-DD.
 * DATE из node-pg обычно приходит как Date в полночь UTC для календарного дня — используем UTC-компоненты.
 */
export function formatPostgresDateOnly(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? '' : toUTCYYYYMMDD(d);
  }
  if (value instanceof Date) {
    return toUTCYYYYMMDD(value);
  }
  return '';
}
