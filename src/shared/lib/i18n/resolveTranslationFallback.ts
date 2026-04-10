/**
 * Детерминированный fallback для строк перевода: current → default → фиксированный порядок локалей.
 * Чистые функции, без мутаций входных данных.
 */

import type { SupportedLang } from '@shared/model/lang';

/** Порядок обхода «остальных» локалей после current и default (не случайный). */
export const TRANSLATION_LOCALE_ORDER: readonly SupportedLang[] = ['en', 'ru'];

export const DEFAULT_CONTENT_LOCALE: SupportedLang = 'ru';

export function isTranslationValueMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return true;
  return value.trim() === '';
}

/**
 * Строит цепочку локалей без повторов: текущая → default → TRANSLATION_LOCALE_ORDER.
 */
export function buildTranslationFallbackLocales(
  current: SupportedLang,
  defaultLocale: SupportedLang = DEFAULT_CONTENT_LOCALE,
  order: readonly SupportedLang[] = TRANSLATION_LOCALE_ORDER
): SupportedLang[] {
  const out: SupportedLang[] = [];
  const push = (l: SupportedLang) => {
    if (!out.includes(l)) out.push(l);
  };
  push(current);
  push(defaultLocale);
  for (const l of order) push(l);
  return out;
}

/**
 * Возвращает значение для строкового поля перевода по карте locale → string.
 */
export function resolveTranslationString(
  byLocale: Partial<Record<SupportedLang, string | null | undefined>>,
  current: SupportedLang,
  options?: {
    defaultLocale?: SupportedLang;
    order?: readonly SupportedLang[];
  }
): string {
  const defaultLocale = options?.defaultLocale ?? DEFAULT_CONTENT_LOCALE;
  const order = options?.order ?? TRANSLATION_LOCALE_ORDER;
  const chain = buildTranslationFallbackLocales(current, defaultLocale, order);
  for (const loc of chain) {
    const raw = byLocale[loc];
    if (!isTranslationValueMissing(raw)) return String(raw).trim();
  }
  return '';
}
