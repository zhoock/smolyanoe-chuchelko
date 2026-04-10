import { describe, test, expect } from '@jest/globals';

import {
  buildTranslationFallbackLocales,
  isTranslationValueMissing,
  resolveTranslationString,
} from '../resolveTranslationFallback';

describe('resolveTranslationFallback', () => {
  test('isTranslationValueMissing', () => {
    expect(isTranslationValueMissing(undefined)).toBe(true);
    expect(isTranslationValueMissing(null)).toBe(true);
    expect(isTranslationValueMissing('')).toBe(true);
    expect(isTranslationValueMissing('  ')).toBe(true);
    expect(isTranslationValueMissing('a')).toBe(false);
  });

  test('buildTranslationFallbackLocales — детерминированный порядок без повторов', () => {
    expect(buildTranslationFallbackLocales('en', 'ru', ['en', 'ru'])).toEqual(['en', 'ru']);
    expect(buildTranslationFallbackLocales('ru', 'ru', ['en', 'ru'])).toEqual(['ru', 'en']);
  });

  test('resolveTranslationString — current → default → order', () => {
    expect(
      resolveTranslationString({ en: '', ru: 'R' }, 'en', {
        defaultLocale: 'ru',
        order: ['en', 'ru'],
      })
    ).toBe('R');
    expect(
      resolveTranslationString({ en: 'E', ru: 'R' }, 'en', {
        defaultLocale: 'ru',
        order: ['en', 'ru'],
      })
    ).toBe('E');
    expect(
      resolveTranslationString({ en: '', ru: '' }, 'en', {
        defaultLocale: 'ru',
        order: ['en', 'ru'],
      })
    ).toBe('');
  });
});
