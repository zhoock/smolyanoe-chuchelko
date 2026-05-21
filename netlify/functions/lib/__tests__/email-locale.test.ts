import { normalizeEmailLocale } from '../email-locale';

describe('email-locale', () => {
  it('maps ru variants to ru', () => {
    expect(normalizeEmailLocale('ru')).toBe('ru');
    expect(normalizeEmailLocale('RU')).toBe('ru');
    expect(normalizeEmailLocale('ru-RU')).toBe('ru');
    expect(normalizeEmailLocale(' ru ')).toBe('ru');
  });

  it('falls back unknown languages to en', () => {
    expect(normalizeEmailLocale('en')).toBe('en');
    expect(normalizeEmailLocale('de')).toBe('en');
    expect(normalizeEmailLocale('')).toBe('en');
    expect(normalizeEmailLocale(null)).toBe('en');
    expect(normalizeEmailLocale(undefined)).toBe('en');
  });
});
