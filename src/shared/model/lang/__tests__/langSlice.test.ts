import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import type { SupportedLang } from '../langSlice';
import type { RootState } from '@shared/model/appStore/types';

// Мокируем getLang ПЕРЕД импортом langSlice
const mockGetLang = jest.fn<() => string | null>();
jest.mock('@shared/lib/lang', () => ({
  getLang: () => mockGetLang(),
}));

import { langActions, langReducer } from '../langSlice';
import { selectCurrentLang } from '../selectors';

describe('langSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reducer', () => {
    test('должен возвращать начальное состояние (язык определяется при загрузке модуля)', () => {
      // initialState вычисляется один раз при загрузке модуля
      // Проверяем только, что состояние валидное
      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toHaveProperty('current');
      expect(['en', 'ru']).toContain(state.current);
    });

    test('должен возвращать валидное начальное состояние', () => {
      // Проверяем, что initialState всегда валидный
      const state = langReducer(undefined, { type: 'unknown' });
      expect(['en', 'ru']).toContain(state.current);
    });
  });

  describe('setLang action', () => {
    test('должен установить язык "en"', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'ru' as SupportedLang },
        },
      });

      store.dispatch(langActions.setLang('en'));

      const state = store.getState();
      expect(state.lang.current).toBe('en');
    });

    test('должен установить язык "ru"', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      store.dispatch(langActions.setLang('ru'));

      const state = store.getState();
      expect(state.lang.current).toBe('ru');
    });

    test('должен переключить язык с "en" на "ru"', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      store.dispatch(langActions.setLang('ru'));

      const state = store.getState();
      expect(state.lang.current).toBe('ru');
    });

    test('должен переключить язык с "ru" на "en"', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'ru' as SupportedLang },
        },
      });

      store.dispatch(langActions.setLang('en'));

      const state = store.getState();
      expect(state.lang.current).toBe('en');
    });

    test('должен установить тот же язык повторно', () => {
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      store.dispatch(langActions.setLang('en'));
      store.dispatch(langActions.setLang('en'));

      const state = store.getState();
      expect(state.lang.current).toBe('en');
    });
  });

  describe('selectCurrentLang selector', () => {
    test('должен вернуть текущий язык "en"', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      const state = store.getState() as RootState;
      expect(selectCurrentLang(state)).toBe('en');
    });

    test('должен вернуть текущий язык "ru"', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'ru' as SupportedLang },
        },
      });

      const state = store.getState() as RootState;
      expect(selectCurrentLang(state)).toBe('ru');
    });

    test('должен вернуть обновленный язык после setLang', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      let state = store.getState() as RootState;
      expect(selectCurrentLang(state)).toBe('en');

      store.dispatch(langActions.setLang('ru'));

      state = store.getState() as RootState;
      expect(selectCurrentLang(state)).toBe('ru');
    });
  });

  describe('edge cases', () => {
    test('должен обработать множественные переключения языка', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      store.dispatch(langActions.setLang('ru'));
      expect(store.getState().lang.current).toBe('ru');

      store.dispatch(langActions.setLang('en'));
      expect(store.getState().lang.current).toBe('en');

      store.dispatch(langActions.setLang('ru'));
      expect(store.getState().lang.current).toBe('ru');
    });

    test('должен обработать быстрые последовательные вызовы setLang', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      // Быстрые последовательные вызовы
      store.dispatch(langActions.setLang('ru'));
      store.dispatch(langActions.setLang('en'));
      store.dispatch(langActions.setLang('ru'));
      store.dispatch(langActions.setLang('en'));

      const state = store.getState();
      expect(state.lang.current).toBe('en');
    });

    test('должен обработать неизвестное действие', () => {
      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
        preloadedState: {
          lang: { current: 'en' as SupportedLang },
        },
      });

      const initialState = store.getState();

      // Диспатчим неизвестное действие
      store.dispatch({ type: 'unknown/action' } as any);

      const state = store.getState();
      expect(state.lang.current).toBe(initialState.lang.current);
    });
  });
});
