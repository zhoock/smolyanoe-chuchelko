import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';

import { detectBrowserLang, getLang, setLang } from '../index';

type WritableNavigator = Pick<Navigator, 'language' | 'languages'>;

const originalLanguageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'language');
const originalLanguagesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'languages');

function mockNavigator(overrides: Partial<WritableNavigator>): void {
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    get: () => overrides.language ?? '',
  });
  Object.defineProperty(navigator, 'languages', {
    configurable: true,
    get: () => overrides.languages ?? [],
  });
}

function restoreNavigator(): void {
  if (originalLanguageDescriptor) {
    Object.defineProperty(navigator, 'language', originalLanguageDescriptor);
  }
  if (originalLanguagesDescriptor) {
    Object.defineProperty(navigator, 'languages', originalLanguagesDescriptor);
  }
}

describe('detectBrowserLang', () => {
  afterAll(() => {
    restoreNavigator();
  });

  test.each([
    ['ru', 'ru'],
    ['ru-RU', 'ru'],
    ['ru_KZ', 'ru'],
    ['RU-ru', 'ru'],
    ['  ru-BY  ', 'ru'],
  ])('maps "%s" → "ru"', (value, expected) => {
    mockNavigator({ language: value, languages: [value] });
    expect(detectBrowserLang()).toBe(expected);
  });

  test.each([
    ['en', 'en'],
    ['en-US', 'en'],
    ['de-DE', 'en'],
    ['fr', 'en'],
    ['zh-CN', 'en'],
    ['', 'en'],
  ])('maps "%s" → "en"', (value, expected) => {
    mockNavigator({ language: value, languages: [value] });
    expect(detectBrowserLang()).toBe(expected);
  });

  test('navigator.languages takes precedence when navigator.language is empty', () => {
    mockNavigator({ language: '', languages: ['ru-RU', 'en-US'] });
    expect(detectBrowserLang()).toBe('ru');
  });

  test('first explicit non-ru language wins over later ru entries', () => {
    mockNavigator({ language: 'en-US', languages: ['en-US', 'ru-RU'] });
    expect(detectBrowserLang()).toBe('en');
  });
});

describe('getLang', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    restoreNavigator();
    localStorage.clear();
  });

  test('returns stored "en" preference even when browser is Russian', () => {
    mockNavigator({ language: 'ru-RU', languages: ['ru-RU'] });
    setLang('en');
    expect(getLang()).toBe('en');
  });

  test('returns stored "ru" preference even when browser is English', () => {
    mockNavigator({ language: 'en-US', languages: ['en-US'] });
    setLang('ru');
    expect(getLang()).toBe('ru');
  });

  test('falls back to detected browser lang when nothing stored', () => {
    mockNavigator({ language: 'ru-RU', languages: ['ru-RU'] });
    expect(getLang()).toBe('ru');
  });

  test('falls back to detected browser lang when stored value is garbage', () => {
    mockNavigator({ language: 'ru', languages: ['ru'] });
    localStorage.setItem('lang', 'klingon');
    expect(getLang()).toBe('ru');
  });

  test('falls back to "en" when no preference and no usable navigator', () => {
    mockNavigator({ language: '', languages: [] });
    expect(getLang()).toBe('en');
  });
});
