import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { isDashboardPathname } from '@shared/lib/publicArtistContext';
import { selectPublicArtistSlug } from '@shared/model/currentArtist';

import { hydrateMissingRuTranslationsOnArticle } from '../lib/hydrateMissingRuTranslations';

import type { ArticlesState } from './types';

const initialState: ArticlesState = {
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
  lastPublicArtistSlug: null,
  inFlightFetchContextKey: null,
};

export type FetchArticlesArg = {
  force?: boolean;
  /** Явный slug из loader URL; иначе берётся из `currentArtist` в store */
  publicArtistSlug?: string | null;
};

export type FetchArticlesResult = {
  articles: IArticles[];
  lastPublicArtistSlug: string | null;
};

function resolvePublicArtistSlugForFetch(arg: FetchArticlesArg, getState: () => RootState): string {
  if (arg.publicArtistSlug !== undefined && arg.publicArtistSlug !== null) {
    return String(arg.publicArtistSlug).trim();
  }
  return selectPublicArtistSlug(getState())?.trim() ?? '';
}

async function readStaticArticlesFallback(
  lang: 'en' | 'ru',
  signal: AbortSignal
): Promise<unknown[]> {
  const fallback = await fetch(`/assets/articles-${lang}.json`, { signal });
  if (!fallback || !fallback.ok) return [];

  const contentType = fallback.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return [];
  }

  const data = await fallback.json();
  return Array.isArray(data) ? data : [];
}

export const fetchArticles = createAsyncThunk<
  FetchArticlesResult,
  FetchArticlesArg,
  { rejectValue: string; state: RootState }
>(
  'articles/fetchMerged',
  async (_arg, { signal, rejectWithValue, getState }) => {
    const normalize = (data: unknown[]): IArticles[] =>
      data.map((article: unknown) => {
        const a = article as Record<string, unknown>;
        if (!a || typeof a !== 'object') {
          return article as IArticles;
        }
        const base = {
          id: a.id as string | undefined,
          userId: a.userId as string | undefined,
          articleId: String(a.articleId ?? ''),
          nameArticle: String(a.nameArticle ?? ''),
          img: String(a.img ?? ''),
          date: String(a.date ?? ''),
          details: Array.isArray(a.details) ? (a.details as IArticles['details']) : [],
          description: String(a.description ?? ''),
          isDraft: (a.isDraft as boolean | undefined) ?? false,
          translations: a.translations as IArticles['translations'],
          updatedAt: a.updatedAt as string | undefined,
          lang: a.lang as IArticles['lang'],
        } as IArticles;
        return hydrateMissingRuTranslationsOnArticle(base);
      });

    try {
      const { getAuthHeader } = await import('@shared/lib/auth');
      const authHeader = getAuthHeader();
      const isDashboardRoute = isDashboardPathname();

      const resolvedSlug = !isDashboardRoute ? resolvePublicArtistSlugForFetch(_arg, getState) : '';

      const fallbackLang: 'en' | 'ru' = getState().lang.current === 'ru' ? 'ru' : 'en';

      const slugMeta = (rows: IArticles[]): FetchArticlesResult => ({
        articles: rows,
        lastPublicArtistSlug: isDashboardRoute ? null : resolvedSlug,
      });

      // Публичный каталог: без artist не дергаем API (инвариант), только статический fallback.
      if (!isDashboardRoute && !resolvedSlug) {
        try {
          const data = await readStaticArticlesFallback(fallbackLang, signal);
          return slugMeta(normalize(data));
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.warn('[fetchArticles] Static fallback failed:', errorMessage);
          return slugMeta([]);
        }
      }

      let apiFailure: unknown = null;

      try {
        const response = await fetch(
          buildApiUrl(
            '/api/articles-api',
            {
              includeDrafts: isDashboardRoute ? true : undefined,
            },
            {
              includeArtist: !isDashboardRoute,
              artistSlugOverride: isDashboardRoute ? null : resolvedSlug,
            }
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
          const list = Array.isArray(payload) ? payload : (payload.data ?? payload.articles ?? []);

          if (!Array.isArray(list)) {
            throw new Error('Invalid response from API: expected array');
          }

          if (list.length === 0) {
            return slugMeta([]);
          }

          return slugMeta(normalize(list));
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
        if (isDashboardRoute) {
          console.warn(
            '❌ [articlesSlice] articles API failed in /dashboard; static JSON fallback is disabled',
            apiError
          );
        } else {
          console.warn('[fetchArticles] API request failed, trying static fallback:', errorMessage);
        }
      }

      if (isDashboardRoute) {
        if (apiFailure instanceof Error) {
          throw apiFailure;
        }
        if (apiFailure != null) {
          throw new Error(String(apiFailure));
        }
      } else {
        const data = await readStaticArticlesFallback(fallbackLang, signal);
        if (data.length > 0) return slugMeta(normalize(data));
      }

      if (apiFailure instanceof Error) {
        throw apiFailure;
      }
      throw apiFailure;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: (arg, { getState }) => {
      if (arg.force) {
        return true;
      }
      const state = getState();
      if (state.articles.status === 'loading') {
        return false;
      }

      const isDashboard = isDashboardPathname();
      if (isDashboard) {
        if (state.articles.status === 'succeeded') {
          // Только `null` = данные владельца; иначе в slice ещё публичные статьи (фон под модалкой).
          if (state.articles.lastPublicArtistSlug == null) {
            return false;
          }
        }
        return true;
      }

      const slug = resolvePublicArtistSlugForFetch(arg, getState);
      if (state.articles.status === 'succeeded') {
        const prev = state.articles.lastPublicArtistSlug ?? '';
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
      .addCase(fetchArticles.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
          state.inFlightFetchContextKey = 'dashboard';
        } else {
          state.inFlightFetchContextKey = 'public';
        }
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        const { articles, lastPublicArtistSlug } = action.payload;
        state.data = Array.isArray(articles) ? [...articles] : [];
        state.status = 'succeeded';
        state.error = null;
        state.lastUpdated = Date.now();
        state.lastPublicArtistSlug = lastPublicArtistSlug;
        state.inFlightFetchContextKey = null;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        state.inFlightFetchContextKey = null;
        state.status = 'failed';
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
        state.error = errorText;
      });
  },
});

export const articlesReducer = articlesSlice.reducer;
