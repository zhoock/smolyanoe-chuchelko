/**
 * Единый строковый идентификатор трека в приложении.
 * Legacy из API/JSON как число → "1"; чисто цифровые строки нормализуются; UUID не трогаем.
 */
export function normalizeTrackIdString(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    return String(parseInt(s, 10));
  }
  return s;
}
