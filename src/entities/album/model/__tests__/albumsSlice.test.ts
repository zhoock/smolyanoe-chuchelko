import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { fetchAlbums, albumsReducer } from '../albumsSlice';
import {
  selectAlbumsStatus,
  selectAlbumsError,
  selectAlbumsData,
  selectAlbumById,
} from '../selectors';
import { initialPlayerState } from '@features/player/model/types/playerSchema';
import type { IAlbums } from '@models';
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
      albums: albumsReducer,
      lang: () => ({ current: 'en' as SupportedLang }),
      popup: () => ({ isOpen: false }),
      player: () => initialPlayerState,
      articles: () => ({
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      }),
      uiDictionary: () => ({
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      }),
    },
  });
};

describe('albumsSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reducer', () => {
    test('должен возвращать начальное состояние', () => {
      const state = albumsReducer(undefined, { type: 'unknown' });
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

  describe('fetchAlbums thunk', () => {
    const mockAlbums: IAlbums[] = [
      {
        albumId: 'album-1',
        album: 'Test Album',
        artist: 'Test Artist',
        fullName: 'Test Artist — Test Album',
        description: 'Test Description',
        release: {
          date: '2024-01-01',
        },
        cover: {
          img: 'cover.jpg',
          fullName: 'Test Artist — Test Album',
        },
        tracks: [],
        buttons: {},
        details: [],
      },
    ];

    test('должен успешно загрузить альбомы', async () => {
      mockGetJSON.mockResolvedValueOnce(mockAlbums);

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      expect(result.type).toBe('albums/fetchByLang/fulfilled');
      expect(result.payload).toEqual(mockAlbums);

      const state = store.getState();
      expect(selectAlbumsStatus(state, 'en')).toBe('succeeded');
      expect(selectAlbumsError(state, 'en')).toBeNull();
      expect(selectAlbumsData(state, 'en')).toEqual(mockAlbums);
      expect(selectAlbumsData(state, 'en')[0].albumId).toBe('album-1');
    });

    test('должен обработать ошибку загрузки', async () => {
      const errorMessage = 'Network error';
      mockGetJSON.mockRejectedValueOnce(new Error(errorMessage));

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      expect(result.type).toBe('albums/fetchByLang/rejected');

      const state = store.getState();
      expect(selectAlbumsStatus(state, 'en')).toBe('failed');
      expect(selectAlbumsError(state, 'en')).toBe(errorMessage);
      expect(selectAlbumsData(state, 'en')).toEqual([]);
    });

    test('должен установить статус loading при начале загрузки', async () => {
      mockGetJSON.mockImplementation(() => new Promise(() => {})); // Никогда не разрешается

      const store = createTestStore();
      const promise = (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      // Проверяем состояние во время загрузки
      const loadingState = store.getState();
      expect(selectAlbumsStatus(loadingState, 'en')).toBe('loading');
      expect(selectAlbumsError(loadingState, 'en')).toBeNull();

      // Отменяем промис, чтобы тест завершился
      promise.abort();
    });

    test('не должен запускать загрузку, если данные уже загружаются', async () => {
      mockGetJSON.mockImplementation(() => new Promise(() => {})); // Никогда не разрешается

      const store = createTestStore();

      // Первая загрузка
      const promise1 = (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      // Вторая загрузка (должна быть отменена condition)
      const promise2 = (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      // Проверяем, что getJSON был вызван только один раз
      expect(mockGetJSON).toHaveBeenCalledTimes(1);

      promise1.abort();
      promise2.abort();
    });

    test('не должен запускать загрузку, если данные уже загружены', async () => {
      mockGetJSON.mockResolvedValueOnce(mockAlbums);

      const store = createTestStore();

      // Первая загрузка
      await (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      // Очищаем мок
      jest.clearAllMocks();

      // Вторая загрузка (должна быть отменена condition)
      await (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));

      // Проверяем, что getJSON не был вызван повторно
      expect(mockGetJSON).not.toHaveBeenCalled();
    });

    test('должен работать независимо для разных языков', async () => {
      const enAlbums: IAlbums[] = [
        {
          albumId: 'album-en',
          album: 'English Album',
          artist: 'English Artist',
          fullName: 'English Artist — English Album',
          description: 'English Description',
          release: {
            date: '2024-01-01',
          },
          cover: {
            img: 'cover-en.jpg',
            fullName: 'English Artist — English Album',
          },
          tracks: [],
          buttons: {},
          details: [],
        },
      ];

      const ruAlbums: IAlbums[] = [
        {
          albumId: 'album-ru',
          album: 'Русский альбом',
          artist: 'Русский артист',
          fullName: 'Русский артист — Русский альбом',
          description: 'Русское описание',
          release: {
            date: '2024-01-01',
          },
          cover: {
            img: 'cover-ru.jpg',
            fullName: 'Русский артист — Русский альбом',
          },
          tracks: [],
          buttons: {},
          details: [],
        },
      ];

      mockGetJSON.mockResolvedValueOnce(enAlbums).mockResolvedValueOnce(ruAlbums);

      const store = createTestStore();
      await (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'en' }));
      await (store.dispatch as AppDispatch)(fetchAlbums({ lang: 'ru' }));

      const state = store.getState();
      expect(selectAlbumsData(state, 'en')).toEqual(enAlbums);
      expect(selectAlbumsData(state, 'ru')).toEqual(ruAlbums);
      expect(selectAlbumsData(state, 'en')[0].albumId).toBe('album-en');
      expect(selectAlbumsData(state, 'ru')[0].albumId).toBe('album-ru');
    });
  });

  describe('selectors', () => {
    const mockState = {
      albums: {
        en: {
          status: 'succeeded' as const,
          error: null,
          data: [
            {
              albumId: 'album-1',
              album: 'Test Album',
              artist: 'Test Artist',
              fullName: 'Test Artist — Test Album',
              description: 'Test Description',
              release: {
                date: '2024-01-01',
              },
              cover: {
                img: 'cover.jpg',
                fullName: 'Test Artist — Test Album',
              },
              tracks: [],
              buttons: {},
              details: [],
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
      uiDictionary: {
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      },
    };

    test('selectAlbumsStatus должен возвращать статус', () => {
      expect(selectAlbumsStatus(mockState as any, 'en')).toBe('succeeded');
      expect(selectAlbumsStatus(mockState as any, 'ru')).toBe('idle');
    });

    test('selectAlbumsError должен возвращать ошибку', () => {
      expect(selectAlbumsError(mockState as any, 'en')).toBeNull();
      expect(selectAlbumsError(mockState as any, 'ru')).toBeNull();
    });

    test('selectAlbumsData должен возвращать данные', () => {
      const enData = selectAlbumsData(mockState as any, 'en');
      expect(enData).toHaveLength(1);
      expect(enData[0].albumId).toBe('album-1');

      const ruData = selectAlbumsData(mockState as any, 'ru');
      expect(ruData).toEqual([]);
    });

    test('selectAlbumById должен находить альбом по ID', () => {
      const album = selectAlbumById(mockState as any, 'en', 'album-1');
      expect(album).toBeDefined();
      expect(album?.albumId).toBe('album-1');
      expect(album?.album).toBe('Test Album');
    });

    test('selectAlbumById должен возвращать undefined для несуществующего альбома', () => {
      const album = selectAlbumById(mockState as any, 'en', 'non-existent');
      expect(album).toBeUndefined();
    });
  });
});
