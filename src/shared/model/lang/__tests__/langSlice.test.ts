import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { langActions, langReducer } from '../langSlice';
import { selectCurrentLang } from '../selectors';
import type { SupportedLang } from '../langSlice';
import type { RootState } from '@shared/model/appStore/types';

// Мокируем getLang
jest.mock('@shared/lib/lang', () => ({
  getLang: jest.fn(),
}));

import { getLang } from '@shared/lib/lang';

const mockGetLang = getLang as jest.MockedFunction<typeof getLang>;

describe('langSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reducer', () => {
    test('должен возвращать начальное состояние с языком из localStorage', () => {
      mockGetLang.mockReturnValue('ru');

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        current: 'ru',
      });
      expect(mockGetLang).toHaveBeenCalled();
    });

    test('должен возвращать "en" если localStorage возвращает невалидный язык', () => {
      mockGetLang.mockReturnValue('fr');

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        current: 'en',
      });
    });

    test('должен возвращать "en" если localStorage возвращает "en"', () => {
      mockGetLang.mockReturnValue('en');

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        current: 'en',
      });
    });

    test('должен возвращать "ru" если localStorage возвращает "ru"', () => {
      mockGetLang.mockReturnValue('ru');

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        current: 'ru',
      });
    });

    test('должен возвращать "en" если localStorage возвращает пустую строку', () => {
      mockGetLang.mockReturnValue('');

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        current: 'en',
      });
    });

    test('должен возвращать "en" если localStorage возвращает null', () => {
      mockGetLang.mockReturnValue(null as any);

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        current: 'en',
      });
    });
  });

  describe('setLang action', () => {
    test('должен установить язык "en"', () => {
      mockGetLang.mockReturnValue('ru');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      store.dispatch(langActions.setLang('en'));

      const state = store.getState();
      expect(state.lang.current).toBe('en');
    });

    test('должен установить язык "ru"', () => {
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      store.dispatch(langActions.setLang('ru'));

      const state = store.getState();
      expect(state.lang.current).toBe('ru');
    });

    test('должен переключить язык с "en" на "ru"', () => {
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      const initialState = store.getState();
      expect(initialState.lang.current).toBe('en');

      store.dispatch(langActions.setLang('ru'));

      const state = store.getState();
      expect(state.lang.current).toBe('ru');
    });

    test('должен переключить язык с "ru" на "en"', () => {
      mockGetLang.mockReturnValue('ru');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      const initialState = store.getState();
      expect(initialState.lang.current).toBe('ru');

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
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      const state = store.getState() as RootState;
      expect(selectCurrentLang(state)).toBe('en');
    });

    test('должен вернуть текущий язык "ru"', () => {
      mockGetLang.mockReturnValue('ru');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      const state = store.getState() as RootState;
      expect(selectCurrentLang(state)).toBe('ru');
    });

    test('должен вернуть обновленный язык после setLang', () => {
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
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
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
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
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
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
      mockGetLang.mockReturnValue('en');

      const store = configureStore({
        reducer: {
          lang: langReducer,
        },
      });

      const initialState = store.getState();

      // Диспатчим неизвестное действие
      store.dispatch({ type: 'unknown/action' } as any);

      const state = store.getState();
      expect(state.lang.current).toBe(initialState.lang.current);
    });

    test('должен обработать невалидный язык в начальном состоянии', () => {
      mockGetLang.mockReturnValue('invalid-lang' as any);

      const state = langReducer(undefined, { type: 'unknown' });
      expect(state.current).toBe('en');
    });

    test('должен обработать язык в верхнем регистре', () => {
      mockGetLang.mockReturnValue('EN' as any);

      const state = langReducer(undefined, { type: 'unknown' });
      // Должен вернуть 'en', так как 'EN' !== 'en' и !== 'ru'
      expect(state.current).toBe('en');
    });

    test('должен обработать язык с пробелами', () => {
      mockGetLang.mockReturnValue(' en ' as any);

      const state = langReducer(undefined, { type: 'unknown' });
      // Должен вернуть 'en', так как ' en ' !== 'en' и !== 'ru'
      expect(state.current).toBe('en');
    });
  });
});
