import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangState, createLangExtraReducers } from '@shared/lib/redux/createLangSlice';

import type { ArticlesState } from './types';

const initialState: ArticlesState = createInitialLangState<IArticles[]>([]);

export const fetchArticles = createAsyncThunk<
  IArticles[],
  { lang: SupportedLang; username?: string; force?: boolean; userOnly?: boolean },
  { rejectValue: string; state: RootState }
>(
  'articles/fetchByLang',
  async ({ lang, username, userOnly = false }, { signal, rejectWithValue }) => {
    const resolvedUsername =
      username ||
      (typeof window !== 'undefined'
        ? window.location.pathname.split('/').filter(Boolean)[0] || ''
        : '');

    if (!resolvedUsername) {
      return rejectWithValue('Username is required to load posts.');
    }
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
          userId: article.userId, // UUID владельца статьи (может быть undefined для старых данных)
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
        // Если userOnly=true, загружаем только статьи текущего пользователя
        // Для этого передаем includeDrafts=true, что требует авторизации
        const params = new URLSearchParams({ lang, username: resolvedUsername });
        if (userOnly) {
          params.set('includeDrafts', 'true');
        }

        const url = `/api/articles-api?${params.toString()}`;

        const response = await fetch(url, {
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
          } // ✅ Универсальный разбор: вытаскиваем список откуда бы он ни пришёл
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
          if (response.status === 404) {
            console.warn(
              '[fetchArticles] API returned 404 (user not found). Returning empty articles list.'
            );
            return [];
          }
          // Если ответ не OK, выбрасываем ошибку
          throw new Error(`Failed to fetch articles. Status: ${response.status}`);
        }
      } catch (apiError) {
        // Если API недоступен или вернул ошибку - возвращаем ошибку
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        console.error('[fetchArticles] API request failed:', errorMessage);
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
