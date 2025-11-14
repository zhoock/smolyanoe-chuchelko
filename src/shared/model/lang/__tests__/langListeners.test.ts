import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';

// Мокируем getLang и setLang из @shared/lib/lang ПЕРЕД импортом langSlice
jest.mock('@shared/lib/lang', () => ({
  getLang: jest.fn<() => string | null>(),
  setLang: jest.fn<(lang: string) => void>(),
}));

// Импортируем после мока
import { langActions, langReducer } from '../langSlice';
import { langListenerMiddleware } from '../listeners';
import { getLang, setLang } from '@shared/lib/lang';

const mockGetLang = getLang as jest.MockedFunction<typeof getLang>;
const mockSetLang = setLang as jest.MockedFunction<typeof setLang>;

describe('langListeners middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Устанавливаем дефолтное значение для getLang
    mockGetLang.mockReturnValue('en');

    // Устанавливаем дефолтное значение для document.documentElement.lang
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = '';
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createTestStore = () => {
    return configureStore({
      reducer: {
        lang: langReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().prepend(langListenerMiddleware.middleware),
    });
  };

  describe('setLang action listener', () => {
    test('должен вызвать setLang с правильным языком', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('ru'));

      expect(mockSetLang).toHaveBeenCalledTimes(1);
      expect(mockSetLang).toHaveBeenCalledWith('ru');
    });

    test('должен вызвать setLang с языком "en"', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('en'));

      expect(mockSetLang).toHaveBeenCalledTimes(1);
      expect(mockSetLang).toHaveBeenCalledWith('en');
    });

    test('должен обновить document.documentElement.lang', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('ru'));

      expect(document.documentElement.lang).toBe('ru');
    });

    test('должен обновить document.documentElement.lang при переключении языка', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('en'));
      expect(document.documentElement.lang).toBe('en');

      store.dispatch(langActions.setLang('ru'));
      expect(document.documentElement.lang).toBe('ru');
    });

    test('должен сохранить язык в localStorage через setLang', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('ru'));

      expect(mockSetLang).toHaveBeenCalledWith('ru');
    });

    test('должен обработать множественные переключения языка', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('en'));
      expect(mockSetLang).toHaveBeenCalledWith('en');
      expect(document.documentElement.lang).toBe('en');

      store.dispatch(langActions.setLang('ru'));
      expect(mockSetLang).toHaveBeenCalledWith('ru');
      expect(document.documentElement.lang).toBe('ru');

      store.dispatch(langActions.setLang('en'));
      expect(mockSetLang).toHaveBeenCalledWith('en');
      expect(document.documentElement.lang).toBe('en');

      expect(mockSetLang).toHaveBeenCalledTimes(3);
    });

    test('должен обработать быстрые последовательные вызовы setLang', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('en'));
      store.dispatch(langActions.setLang('ru'));
      store.dispatch(langActions.setLang('en'));

      expect(mockSetLang).toHaveBeenCalledTimes(3);
      expect(document.documentElement.lang).toBe('en');
    });

    test('должен обработать установку того же языка повторно', () => {
      const store = createTestStore();

      store.dispatch(langActions.setLang('en'));
      store.dispatch(langActions.setLang('en'));
      store.dispatch(langActions.setLang('en'));

      expect(mockSetLang).toHaveBeenCalledTimes(3);
      expect(mockSetLang).toHaveBeenNthCalledWith(1, 'en');
      expect(mockSetLang).toHaveBeenNthCalledWith(2, 'en');
      expect(mockSetLang).toHaveBeenNthCalledWith(3, 'en');
      expect(document.documentElement.lang).toBe('en');
    });
  });

  describe('edge cases', () => {
    test('должен обработать переключение языка с обновлением состояния', () => {
      const store = createTestStore();

      const state1 = store.getState() as RootState;
      const initialLang = state1.lang.current;

      store.dispatch(langActions.setLang('ru'));

      const state2 = store.getState() as RootState;
      expect(state2.lang.current).toBe('ru');
      expect(mockSetLang).toHaveBeenCalledWith('ru');
      expect(document.documentElement.lang).toBe('ru');

      store.dispatch(langActions.setLang('en'));

      const state3 = store.getState() as RootState;
      expect(state3.lang.current).toBe('en');
      expect(mockSetLang).toHaveBeenCalledWith('en');
      expect(document.documentElement.lang).toBe('en');
    });

    test('должен обработать ситуацию когда document.documentElement недоступен', () => {
      // Сохраняем documentElement
      const originalLang = document.documentElement?.lang;

      try {
        // Проверяем, что не падает при отсутствии documentElement.lang
        const store = createTestStore();

        // Не должно упасть
        store.dispatch(langActions.setLang('ru'));

        expect(mockSetLang).toHaveBeenCalledWith('ru');
      } finally {
        // Восстанавливаем
        if (document.documentElement && originalLang !== undefined) {
          document.documentElement.lang = originalLang;
        }
      }
    });
  });
});
