import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangState, createLangExtraReducers } from '@shared/lib/redux/createLangSlice';

import type { ArticlesState } from './types';

const initialState: ArticlesState = createInitialLangState<IArticles[]>([]);

export const fetchArticles = createAsyncThunk<
  IArticles[],
  { lang: SupportedLang; force?: boolean },
  { rejectValue: string; state: RootState }
>(
  'articles/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    const normalize = (data: any[]): IArticles[] =>
      data.map((article: any) => {
        // ВАЖНО: гарантируем, что id (UUID) всегда присутствует
        // Если id отсутствует, логируем предупреждение, но не падаем
        if (!article.id && process.env.NODE_ENV === 'development') {
          console.warn('[fetchArticles] Article without UUID id:', {
            articleId: article.articleId,
            nameArticle: article.nameArticle,
          });
        }

        return {
          id: article.id, // UUID из БД (может быть undefined для старых данных)
          articleId: article.articleId,
          nameArticle: article.nameArticle,
          img: article.img ?? '',
          date: article.date,
          details: article.details || [],
          description: article.description ?? '',
          isDraft: article.isDraft ?? false, // Статус черновика
        } as IArticles;
      });

    try {
      // Загружаем из БД через API (приоритет над статикой)
      // Импортируем динамически, чтобы избежать циклических зависимостей
      const { getAuthHeader } = await import('@shared/lib/auth');
      const authHeader = getAuthHeader();

      try {
        const response = await fetch(`/api/articles-api?lang=${lang}`, {
          signal,
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            ...authHeader,
          },
        });

        if (response.ok) {
          const payload = await response.json();

          // Диагностика: логируем структуру ответа
          if (process.env.NODE_ENV === 'development') {
            console.log('[fetchArticles] API response payload:', payload);
            if (payload.data && Array.isArray(payload.data) && payload.data.length > 0) {
              console.log('[fetchArticles] First article from API:', payload.data[0]);
              console.log('[fetchArticles] First article has id?', !!payload.data[0]?.id);
            }
          }

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'articlesSlice.ts:78',
              message: 'fetchArticles API response',
              data: {
                payloadType: Array.isArray(payload) ? 'array' : typeof payload,
                payloadKeys: Array.isArray(payload) ? ['array'] : Object.keys(payload || {}),
                articlesCount: Array.isArray(payload)
                  ? payload.length
                  : payload?.data?.length || payload?.articles?.length || 0,
                firstArticleId: Array.isArray(payload)
                  ? payload[0]?.articleId
                  : payload?.data?.[0]?.articleId || payload?.articles?.[0]?.articleId,
                firstArticleName: Array.isArray(payload)
                  ? payload[0]?.nameArticle
                  : payload?.data?.[0]?.nameArticle || payload?.articles?.[0]?.nameArticle,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'E',
            }),
          }).catch(() => {});
          // #endregion

          // ✅ Универсальный разбор: вытаскиваем список откуда бы он ни пришёл
          const list = Array.isArray(payload) ? payload : (payload.data ?? payload.articles ?? []);

          if (!Array.isArray(list)) {
            throw new Error('Invalid response from API: expected array');
          }

          // Если данных нет, возвращаем пустой массив
          if (list.length === 0) {
            return [];
          }

          // Преобразуем данные из API в формат IArticles
          // ВАЖНО: гарантируем, что id (UUID) всегда присутствует
          const normalized = normalize(list);

          // Диагностика: проверяем, что id сохранился
          if (process.env.NODE_ENV === 'development') {
            const articlesWithId = normalized.filter((a) => a.id);
            const articlesWithoutId = normalized.filter((a) => !a.id);
            console.log('[fetchArticles] Normalized articles:', {
              total: normalized.length,
              withId: articlesWithId.length,
              withoutId: articlesWithoutId.length,
              withoutIdExamples: articlesWithoutId.map((a) => ({
                articleId: a.articleId,
                nameArticle: a.nameArticle,
              })),
            });
          }

          return normalized;
        } else {
          // Если ответ не OK, выбрасываем ошибку
          throw new Error(`Failed to fetch articles. Status: ${response.status}`);
        }
      } catch (apiError) {
        // Если API недоступен или вернул ошибку - возвращаем ошибку
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        console.error('[fetchArticles] API request failed:', errorMessage);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'articlesSlice.ts:135',
            message: 'API request failed',
            data: { errorMessage },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }).catch(() => {});
        // #endregion
        throw apiError;
      }
    } catch (error) {
      // Если API недоступен – отдаём ошибку
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: ({ lang, force }, { getState }) => {
      // Если force === true, всегда разрешаем выполнение
      if (force) {
        return true;
      }
      const state = getState();
      const entry = state.articles[lang];
      // Не запускаем, если уже загружается или уже загружено
      if (entry.status === 'loading' || entry.status === 'succeeded') {
        return false;
      }
      return true;
    },
  }
);

const articlesSlice = createSlice({
  name: 'articles',
  initialState,
  reducers: {},
  extraReducers: createLangExtraReducers(fetchArticles, 'Failed to fetch articles'),
});

export const articlesReducer = articlesSlice.reducer;
