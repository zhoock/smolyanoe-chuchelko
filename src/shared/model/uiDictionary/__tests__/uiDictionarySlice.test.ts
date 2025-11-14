import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { fetchUiDictionary, uiDictionaryReducer } from '../uiDictionarySlice';
import {
  selectUiDictionaryStatus,
  selectUiDictionaryError,
  selectUiDictionaryData,
  selectUiDictionaryFirst,
} from '../selectors';
import { initialPlayerState } from '@features/player/model/types/playerSchema';
import type { IInterface } from '@models';
import type { SupportedLang } from '@shared/model/lang';
import type { AppDispatch } from '@shared/model/appStore/types';

// Мокируем getJSON
jest.mock('@shared/api/http', () => ({
  getJSON: jest.fn(),
}));

import { getJSON } from '@shared/api/http';

const mockGetJSON = getJSON as jest.MockedFunction<typeof getJSON>;

// Вспомогательная функция для создания тестового store
const createTestStore = () => {
  return configureStore({
    reducer: {
      uiDictionary: uiDictionaryReducer,
      lang: () => ({ current: 'en' as SupportedLang }),
      popup: () => ({ isOpen: false }),
      player: () => initialPlayerState,
      articles: () => ({
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      }),
      albums: () => ({
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      }),
    },
  });
};

describe('uiDictionarySlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reducer', () => {
    test('должен возвращать начальное состояние', () => {
      const state = uiDictionaryReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        en: {
          status: 'idle',
          error: null,
          data: [],
          lastUpdated: null,
        },
        ru: {
          status: 'idle',
          error: null,
          data: [],
          lastUpdated: null,
        },
      });
    });
  });

  describe('fetchUiDictionary thunk', () => {
    const mockDictionary: IInterface[] = [
      {
        titles: {
          albums: 'Albums',
          articles: 'Articles',
        },
        menu: {
          stems: 'Mixer',
        },
        buttons: {
          playButton: 'Play',
        },
        theBand: [],
      },
    ];

    test('должен успешно загрузить UI словарь', async () => {
      mockGetJSON.mockResolvedValueOnce(mockDictionary);

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      expect(result.type).toBe('uiDictionary/fetchByLang/fulfilled');
      expect(result.payload).toEqual(mockDictionary);

      const state = store.getState();
      expect(selectUiDictionaryStatus(state, 'en')).toBe('succeeded');
      expect(selectUiDictionaryError(state, 'en')).toBeNull();
      expect(selectUiDictionaryData(state, 'en')).toEqual(mockDictionary);
      expect(selectUiDictionaryData(state, 'en')[0].titles?.albums).toBe('Albums');
    });

    test('должен обработать ошибку загрузки', async () => {
      const errorMessage = 'Network error';
      mockGetJSON.mockRejectedValueOnce(new Error(errorMessage));

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      expect(result.type).toBe('uiDictionary/fetchByLang/rejected');

      const state = store.getState();
      expect(selectUiDictionaryStatus(state, 'en')).toBe('failed');
      expect(selectUiDictionaryError(state, 'en')).toBe(errorMessage);
      expect(selectUiDictionaryData(state, 'en')).toEqual([]);
    });

    test('должен установить статус loading при начале загрузки', async () => {
      mockGetJSON.mockImplementation(() => new Promise(() => {})); // Никогда не разрешается

      const store = createTestStore();
      const promise = (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      // Проверяем состояние во время загрузки
      const loadingState = store.getState();
      expect(selectUiDictionaryStatus(loadingState, 'en')).toBe('loading');
      expect(selectUiDictionaryError(loadingState, 'en')).toBeNull();

      // Отменяем промис, чтобы тест завершился
      promise.abort();
    });

    test('не должен запускать загрузку, если данные уже загружаются', async () => {
      mockGetJSON.mockImplementation(() => new Promise(() => {})); // Никогда не разрешается

      const store = createTestStore();

      // Первая загрузка
      const promise1 = (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      // Вторая загрузка (должна быть отменена condition)
      const promise2 = (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      // Проверяем, что getJSON был вызван только один раз
      expect(mockGetJSON).toHaveBeenCalledTimes(1);

      promise1.abort();
      promise2.abort();
    });

    test('не должен запускать загрузку, если данные уже загружены', async () => {
      mockGetJSON.mockResolvedValueOnce(mockDictionary);

      const store = createTestStore();

      // Первая загрузка
      await (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      // Очищаем мок
      jest.clearAllMocks();

      // Вторая загрузка (должна быть отменена condition)
      await (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));

      // Проверяем, что getJSON не был вызван повторно
      expect(mockGetJSON).not.toHaveBeenCalled();
    });

    test('должен работать независимо для разных языков', async () => {
      const enDictionary: IInterface[] = [
        {
          titles: {
            albums: 'Albums',
            articles: 'Articles',
          },
          menu: {
            stems: 'Mixer',
          },
          buttons: {
            playButton: 'Play',
          },
          theBand: [],
        },
      ];

      const ruDictionary: IInterface[] = [
        {
          titles: {
            albums: 'Альбомы',
            articles: 'Статьи',
          },
          menu: {
            stems: 'Миксер',
          },
          buttons: {
            playButton: 'Воспроизвести',
          },
          theBand: [],
        },
      ];

      mockGetJSON.mockResolvedValueOnce(enDictionary).mockResolvedValueOnce(ruDictionary);

      const store = createTestStore();
      await (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'en' }));
      await (store.dispatch as AppDispatch)(fetchUiDictionary({ lang: 'ru' }));

      const state = store.getState();
      expect(selectUiDictionaryData(state, 'en')).toEqual(enDictionary);
      expect(selectUiDictionaryData(state, 'ru')).toEqual(ruDictionary);
      expect(selectUiDictionaryData(state, 'en')[0].titles?.albums).toBe('Albums');
      expect(selectUiDictionaryData(state, 'ru')[0].titles?.albums).toBe('Альбомы');
    });
  });

  describe('selectors', () => {
    const mockState = {
      uiDictionary: {
        en: {
          status: 'succeeded' as const,
          error: null,
          data: [
            {
              titles: {
                albums: 'Albums',
                articles: 'Articles',
              },
              menu: {
                stems: 'Mixer',
              },
              buttons: {
                playButton: 'Play',
              },
              theBand: [],
            },
          ],
          lastUpdated: 1234567890,
        },
        ru: {
          status: 'idle' as const,
          error: null,
          data: [],
          lastUpdated: null,
        },
      },
      lang: { current: 'en' as SupportedLang },
      popup: { isOpen: false },
      player: initialPlayerState,
      articles: {
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      },
      albums: {
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      },
    };

    test('selectUiDictionaryStatus должен возвращать статус', () => {
      expect(selectUiDictionaryStatus(mockState as any, 'en')).toBe('succeeded');
      expect(selectUiDictionaryStatus(mockState as any, 'ru')).toBe('idle');
    });

    test('selectUiDictionaryError должен возвращать ошибку', () => {
      expect(selectUiDictionaryError(mockState as any, 'en')).toBeNull();
      expect(selectUiDictionaryError(mockState as any, 'ru')).toBeNull();
    });

    test('selectUiDictionaryData должен возвращать данные', () => {
      const enData = selectUiDictionaryData(mockState as any, 'en');
      expect(enData).toHaveLength(1);
      expect(enData[0].titles?.albums).toBe('Albums');

      const ruData = selectUiDictionaryData(mockState as any, 'ru');
      expect(ruData).toEqual([]);
    });

    test('selectUiDictionaryFirst должен возвращать первый элемент', () => {
      const first = selectUiDictionaryFirst(mockState as any, 'en');
      expect(first).toBeDefined();
      expect(first?.titles?.albums).toBe('Albums');
      expect(first?.menu?.stems).toBe('Mixer');
    });

    test('selectUiDictionaryFirst должен возвращать null для пустого массива', () => {
      const first = selectUiDictionaryFirst(mockState as any, 'ru');
      expect(first).toBeNull();
    });
  });
});
