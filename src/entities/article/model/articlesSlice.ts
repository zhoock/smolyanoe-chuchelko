import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangEntry } from '@shared/lib/redux/createLangSlice';
import { buildApiUrl } from '@shared/lib/artistQuery';

import type { ArticlesState, ArticlesEntry } from './types';

const initialState: ArticlesState = {
  en: { ...createInitialLangEntry<IArticles[]>([]), lastPublicArtistSlug: null },
  ru: { ...createInitialLangEntry<IArticles[]>([]), lastPublicArtistSlug: null },
};

export type FetchArticlesArg = {
  lang: SupportedLang;
  force?: boolean;
  /** Явный slug из loader URL; на дашборде не задаётся */
  publicArtistSlug?: string | null;
};

function resolvePublicArtistSlugForFetch(arg: FetchArticlesArg): string {
  if (arg.publicArtistSlug !== undefined && arg.publicArtistSlug !== null) {
    return String(arg.publicArtistSlug).trim();
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/dashboard')) {
    return new URLSearchParams(window.location.search).get('artist')?.trim() ?? '';
  }
  return '';
}

export const fetchArticles = createAsyncThunk<
  IArticles[],
  FetchArticlesArg,
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
          userId: article.userId,
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
      const isDashboardRoute =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

      let apiFailure: unknown = null;

      try {
        const response = await fetch(
          buildApiUrl(
            '/api/articles-api',
            {
              lang,
              includeDrafts: isDashboardRoute ? true : undefined,
            },
            { includeArtist: !isDashboardRoute }
          ),
          {
            signal,
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              ...authHeader,
            },
          }
        );

        if (response && response.ok) {
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
          apiFailure = new Error(
            response
              ? `Failed to fetch articles. Status: ${response.status}`
              : 'No response from API'
          );
        }
      } catch (apiError) {
        apiFailure = apiError;
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        console.warn('[fetchArticles] API request failed, trying static fallback:', errorMessage);
      }

      const fallback = await fetch(`/assets/articles-${lang}.json`, { signal });
      if (fallback && fallback.ok) {
        const data = await fallback.json();
        if (Array.isArray(data)) {
          return normalize(data);
        }
      }

      if (apiFailure instanceof Error) {
        throw apiFailure;
      }
      // null / string / etc. — внешний catch отдаёт Unknown error для не-Error
      throw apiFailure;
    } catch (error) {
      // Если API недоступен – отдаём ошибку
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: (arg, { getState }) => {
      const { lang, force } = arg;
      if (force) {
        return true;
      }
      const state = getState();
      const entry = state.articles[lang] as ArticlesEntry;
      if (entry.status === 'loading') {
        return false;
      }

      const isDashboard =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');
      if (isDashboard) {
        if (entry.status === 'succeeded') {
          return false;
        }
        return true;
      }

      const slug = resolvePublicArtistSlugForFetch(arg);
      if (entry.status === 'succeeded') {
        const prev = entry.lastPublicArtistSlug ?? '';
        if (prev !== slug) {
          return true;
        }
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
  extraReducers: (builder) => {
    builder
      .addCase(fetchArticles.pending, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'loading';
        entry.error = null;
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        const { lang } = action.meta.arg;
        const newData = Array.isArray(action.payload) ? [...action.payload] : action.payload;
        const isDashboard =
          typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');
        const slug = isDashboard ? null : resolvePublicArtistSlugForFetch(action.meta.arg);
        state[lang] = {
          ...state[lang],
          data: newData as IArticles[],
          status: 'succeeded',
          error: null,
          lastUpdated: Date.now(),
          lastPublicArtistSlug: slug,
        };
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'failed';
        let errorText = 'Failed to fetch articles';
        if (action.payload) {
          errorText = action.payload;
        } else if (action.error) {
          if (typeof action.error === 'string') {
            errorText = action.error;
          } else if (
            action.error &&
            typeof action.error === 'object' &&
            'message' in action.error
          ) {
            errorText = (action.error as { message?: string }).message || errorText;
          }
        }
        entry.error = errorText;
      });
  },
});

export const articlesReducer = articlesSlice.reducer;
