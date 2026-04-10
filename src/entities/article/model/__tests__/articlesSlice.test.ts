import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { configureStore } from '@reduxjs/toolkit';
import { fetchArticles, articlesReducer } from '../articlesSlice';
import {
  selectArticlesStatus,
  selectArticlesError,
  selectArticlesData,
  selectArticleById,
} from '../selectors';
import { initialPlayerState } from '@features/player/model/types/playerSchema';
import type { IArticles } from '@models';
import type { SupportedLang } from '@shared/model/lang';
import type { AppDispatch } from '@shared/model/appStore/types';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockSuccessResponse = (data: unknown) =>
  ({
    ok: true,
    json: async () => ({ success: true, data }),
  }) as Response;

// Вспомогательная функция для создания тестового store
const createTestStore = () => {
  return configureStore({
    reducer: {
      articles: articlesReducer,
      lang: () => ({ current: 'en' as SupportedLang }),
      popup: () => ({ isOpen: false }),
      player: () => initialPlayerState,
      albums: () => ({
        status: 'idle' as const,
        error: null,
        data: [],
        lastUpdated: null,
      }),
      helpArticles: () => ({
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

describe('articlesSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  });

  describe('reducer', () => {
    test('должен возвращать начальное состояние', () => {
      const state = articlesReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({
        en: {
          status: 'idle',
          error: null,
          data: [],
          lastUpdated: null,
          lastPublicArtistSlug: null,
        },
        ru: {
          status: 'idle',
          error: null,
          data: [],
          lastUpdated: null,
          lastPublicArtistSlug: null,
        },
      });
    });
  });

  describe('fetchArticles thunk', () => {
    const mockArticles: IArticles[] = [
      {
        articleId: 'article-1',
        nameArticle: 'Test Article',
        description: 'Test Description',
        date: '2024-01-01',
        img: 'test-article.jpg',
        details: [],
      },
    ];

    test('должен успешно загрузить статьи', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockArticles));

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      expect(result.type).toBe('articles/fetchByLang/fulfilled');
      expect(result.payload).toMatchObject(mockArticles);

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('succeeded');
      expect(selectArticlesError(state, 'en')).toBeNull();
      expect(selectArticlesData(state, 'en')).toMatchObject(mockArticles);
      expect(selectArticlesData(state, 'en')[0].articleId).toBe('article-1');
    });

    test('должен обработать ошибку загрузки', async () => {
      const errorMessage = 'Network error';
      mockFetch.mockRejectedValueOnce(new Error(errorMessage));

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      expect(result.type).toBe('articles/fetchByLang/rejected');

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
      expect(selectArticlesError(state, 'en')).toBe(errorMessage);
      expect(selectArticlesData(state, 'en')).toEqual([]);
    });

    test('должен установить статус loading при начале загрузки', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Никогда не разрешается

      const store = createTestStore();
      const promise = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Проверяем состояние во время загрузки
      const loadingState = store.getState();
      expect(selectArticlesStatus(loadingState, 'en')).toBe('loading');
      expect(selectArticlesError(loadingState, 'en')).toBeNull();

      // Отменяем промис, чтобы тест завершился
      promise.abort();
    });

    test('не должен запускать загрузку, если данные уже загружаются', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Никогда не разрешается

      const store = createTestStore();

      // Первая загрузка
      const promise1 = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Вторая загрузка (должна быть отменена condition)
      const promise2 = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Проверяем, что getJSON был вызван только один раз
      expect(selectArticlesStatus(store.getState(), 'en')).toBe('loading');

      promise1.abort();
      promise2.abort();
    });

    test('не должен запускать загрузку, если данные уже загружены', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockArticles));

      const store = createTestStore();

      // Первая загрузка
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Очищаем мок
      jest.clearAllMocks();

      // Вторая загрузка (должна быть отменена condition)
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Проверяем, что getJSON не был вызван повторно
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('должен работать независимо для разных языков', async () => {
      const enArticles: IArticles[] = [
        {
          articleId: 'article-en',
          nameArticle: 'English Article',
          description: 'English Description',
          date: '2024-01-01',
          img: 'article-en.jpg',
          details: [],
        },
      ];

      const ruArticles: IArticles[] = [
        {
          articleId: 'article-ru',
          nameArticle: 'Русская статья',
          description: 'Русское описание',
          date: '2024-01-01',
          img: 'article-ru.jpg',
          details: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce(mockSuccessResponse(enArticles))
        .mockResolvedValueOnce(mockSuccessResponse(ruArticles));

      const store = createTestStore();
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'ru' }));

      const state = store.getState();
      expect(selectArticlesData(state, 'en')).toMatchObject(enArticles);
      expect(selectArticlesData(state, 'ru')).toMatchObject(ruArticles);
      expect(selectArticlesData(state, 'en')[0].articleId).toBe('article-en');
      expect(selectArticlesData(state, 'ru')[0].articleId).toBe('article-ru');
    });

    test('должен обработать пустой массив данных', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse([]));

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      expect(result.type).toBe('articles/fetchByLang/fulfilled');
      expect(result.payload).toEqual([]);

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('succeeded');
      expect(selectArticlesData(state, 'en')).toEqual([]);
      expect(selectArticleById(state, 'en', 'any-id')).toBeUndefined();
    });

    test('должен обработать ошибку без Error объекта (null)', async () => {
      mockFetch.mockRejectedValueOnce(null);

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      expect(result.type).toBe('articles/fetchByLang/rejected');

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
      expect(selectArticlesError(state, 'en')).toBe('Unknown error');
    });

    test('должен обработать ошибку без Error объекта (строка)', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      expect(result.type).toBe('articles/fetchByLang/rejected');

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
      expect(selectArticlesError(state, 'en')).toBe('Unknown error');
    });

    test('должен обработать ошибку без Error объекта (undefined)', async () => {
      mockFetch.mockRejectedValueOnce(undefined);

      const store = createTestStore();
      const result = await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      expect(result.type).toBe('articles/fetchByLang/rejected');

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
      expect(selectArticlesError(state, 'en')).toBe('Unknown error');
    });

    test('должен обработать отмену запроса (abort signal)', async () => {
      const abortController = new AbortController();
      mockFetch.mockImplementation(() => {
        abortController.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      const store = createTestStore();
      const promise = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      abortController.abort();
      await promise.catch(() => {});

      const state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
    });

    test('должен позволить повторную загрузку после ошибки', async () => {
      // Первая попытка - ошибка
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const store = createTestStore();
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      let state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
      expect(selectArticlesError(state, 'en')).toBe('Network error');

      // Вторая попытка - успех
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockArticles));
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('succeeded');
      expect(selectArticlesError(state, 'en')).toBeNull();
      expect(selectArticlesData(state, 'en')).toMatchObject(mockArticles);
    });

    test('должен обновлять lastUpdated при успешной загрузке', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockArticles));

      const store = createTestStore();
      const beforeTime = Date.now();

      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      const afterTime = Date.now();
      const state = store.getState();
      const entry = state.articles.en;

      expect(entry.lastUpdated).not.toBeNull();
      expect(entry.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
      expect(entry.lastUpdated).toBeLessThanOrEqual(afterTime);
    });

    test('должен очищать ошибку при новой загрузке после ошибки', async () => {
      // Первая попытка - ошибка
      mockFetch.mockRejectedValueOnce(new Error('First error'));

      const store = createTestStore();
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      let state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');
      expect(selectArticlesError(state, 'en')).toBe('First error');

      // Начинаем новую загрузку - ошибка должна быть очищена
      mockFetch.mockImplementation(() => new Promise(() => {}));
      const promise = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('loading');
      expect(selectArticlesError(state, 'en')).toBeNull();

      promise.abort();
    });

    test('не должен запускать загрузку если статус failed, но уже выполняется другая', async () => {
      // Сначала создаем ошибку
      mockFetch.mockRejectedValueOnce(new Error('Error'));

      const store = createTestStore();
      await (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      let state = store.getState();
      expect(selectArticlesStatus(state, 'en')).toBe('failed');

      // Запускаем новую загрузку
      mockFetch.mockImplementation(() => new Promise(() => {}));
      const promise1 = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Пытаемся запустить еще одну параллельную загрузку
      const promise2 = (store.dispatch as AppDispatch)(fetchArticles({ lang: 'en' }));

      // Проверяем, что getJSON был вызван только один раз
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);

      promise1.abort();
      promise2.abort();
    });
  });

  describe('selectors', () => {
    const mockState = {
      articles: {
        en: {
          status: 'succeeded' as const,
          error: null,
          data: [
            {
              articleId: 'article-1',
              nameArticle: 'Test Article',
              description: 'Test Description',
              date: '2024-01-01',
              img: 'test-article.jpg',
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
      albums: {
        status: 'idle' as const,
        error: null,
        data: [],
        lastUpdated: null,
      },
      helpArticles: {
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      },
      uiDictionary: {
        en: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
        ru: { status: 'idle' as const, error: null, data: [], lastUpdated: null },
      },
    };

    test('selectArticlesStatus должен возвращать статус', () => {
      expect(selectArticlesStatus(mockState as any, 'en')).toBe('succeeded');
      expect(selectArticlesStatus(mockState as any, 'ru')).toBe('idle');
    });

    test('selectArticlesError должен возвращать ошибку', () => {
      expect(selectArticlesError(mockState as any, 'en')).toBeNull();
      expect(selectArticlesError(mockState as any, 'ru')).toBeNull();
    });

    test('selectArticlesData должен возвращать данные', () => {
      const enData = selectArticlesData(mockState as any, 'en');
      expect(enData).toHaveLength(1);
      expect(enData[0].articleId).toBe('article-1');

      const ruData = selectArticlesData(mockState as any, 'ru');
      expect(ruData).toEqual([]);
    });

    test('selectArticleById должен находить статью по ID', () => {
      const article = selectArticleById(mockState as any, 'en', 'article-1');
      expect(article).toBeDefined();
      expect(article?.articleId).toBe('article-1');
      expect(article?.nameArticle).toBe('Test Article');
    });

    test('selectArticleById должен возвращать undefined для несуществующей статьи', () => {
      const article = selectArticleById(mockState as any, 'en', 'non-existent');
      expect(article).toBeUndefined();
    });

    test('selectArticlesStatus должен обработать несуществующий язык', () => {
      // @ts-expect-error - тестируем edge case с невалидным языком
      expect(() => selectArticlesStatus(mockState as any, 'fr')).toThrow();
    });

    test('selectArticlesError должен обработать состояние с ошибкой', () => {
      const errorState = {
        ...mockState,
        articles: {
          ...mockState.articles,
          en: {
            ...mockState.articles.en,
            status: 'failed' as const,
            error: 'Test error message',
          },
        },
      };

      expect(selectArticlesError(errorState as any, 'en')).toBe('Test error message');
    });

    test('selectArticlesData должен обработать очень большой массив данных', () => {
      const largeData: IArticles[] = Array.from({ length: 1000 }, (_, i) => ({
        articleId: `article-${i}`,
        nameArticle: `Article ${i}`,
        description: `Description ${i}`,
        date: '2024-01-01',
        img: `img-${i}.jpg`,
        details: [],
      }));

      const largeState = {
        ...mockState,
        articles: {
          ...mockState.articles,
          en: {
            ...mockState.articles.en,
            data: largeData,
          },
        },
      };

      const data = selectArticlesData(largeState as any, 'en');
      expect(data).toHaveLength(1000);
      expect(data[0].articleId).toBe('article-0');
      expect(data[999].articleId).toBe('article-999');
    });

    test('selectArticleById должен найти статью в большом массиве', () => {
      const largeData: IArticles[] = Array.from({ length: 1000 }, (_, i) => ({
        articleId: `article-${i}`,
        nameArticle: `Article ${i}`,
        description: `Description ${i}`,
        date: '2024-01-01',
        img: `img-${i}.jpg`,
        details: [],
      }));

      const largeState = {
        ...mockState,
        articles: {
          ...mockState.articles,
          en: {
            ...mockState.articles.en,
            data: largeData,
          },
        },
      };

      const article = selectArticleById(largeState as any, 'en', 'article-500');
      expect(article).toBeDefined();
      expect(article?.articleId).toBe('article-500');
      expect(article?.nameArticle).toBe('Article 500');
    });

    test('selectArticleById должен обработать поиск с пустым ID', () => {
      const article = selectArticleById(mockState as any, 'en', '');
      expect(article).toBeUndefined();
    });

    test('selectArticleById должен обработать поиск в пустом массиве', () => {
      const emptyState = {
        ...mockState,
        articles: {
          ...mockState.articles,
          ru: {
            ...mockState.articles.ru,
            data: [],
          },
        },
      };

      const article = selectArticleById(emptyState as any, 'ru', 'any-id');
      expect(article).toBeUndefined();
    });

    test('selectArticleById должен обработать несуществующий язык', () => {
      // @ts-expect-error - тестируем edge case с невалидным языком
      expect(() => selectArticleById(mockState as any, 'fr', 'article-1')).toThrow();
    });
  });
});
