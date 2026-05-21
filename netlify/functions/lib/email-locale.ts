export type EmailLocale = 'ru' | 'en';

/** ru → ru, everything else (unknown/null) → en */
export function normalizeEmailLocale(input?: string | null): EmailLocale {
  const value = input?.trim().toLowerCase();
  if (value === 'ru' || value?.startsWith('ru-') || value?.startsWith('ru_')) {
    return 'ru';
  }
  return 'en';
}
