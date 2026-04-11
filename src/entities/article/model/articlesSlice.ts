import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { buildApiUrl } from '@shared/lib/artistQuery';

import { hydrateMissingRuTranslationsOnArticle } from '../lib/hydrateMissingRuTranslations';

import type { ArticlesState } from './types';

const initialState: ArticlesState = {
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
  lastPublicArtistSlug: null,
};

export type FetchArticlesArg = {
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
  'articles/fetchMerged',
  async (_arg, { signal, rejectWithValue }) => {
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
      const isDashboardRoute =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

      let apiFailure: unknown = null;

      try {
        const response = await fetch(
          buildApiUrl(
            '/api/articles-api',
            {
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
          const list = Array.isArray(payload) ? payload : (payload.data ?? payload.articles ?? []);

          if (!Array.isArray(list)) {
            throw new Error('Invalid response from API: expected array');
          }

          if (list.length === 0) {
            return [];
          }

          return normalize(list);
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

      let fallbackLang: 'en' | 'ru' = 'en';
      try {
        const { getStore } = await import('@shared/model/appStore');
        fallbackLang = getStore().getState().lang.current === 'ru' ? 'ru' : 'en';
      } catch {
        fallbackLang = 'en';
      }
      const fallback = await fetch(`/assets/articles-${fallbackLang}.json`, { signal });
      if (fallback && fallback.ok) {
        const data = await fallback.json();
        if (Array.isArray(data)) {
          return normalize(data);
        }
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

      const isDashboard =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');
      if (isDashboard) {
        if (state.articles.status === 'succeeded') {
          return false;
        }
        return true;
      }

      const slug = resolvePublicArtistSlugForFetch(arg);
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
      })
      .addCase(fetchArticles.fulfilled, (state, action) => {
        const newData = Array.isArray(action.payload) ? [...action.payload] : action.payload;
        const isDashboard =
          typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');
        const slug = isDashboard ? null : resolvePublicArtistSlugForFetch(action.meta.arg);
        state.data = newData as IArticles[];
        state.status = 'succeeded';
        state.error = null;
        state.lastUpdated = Date.now();
        state.lastPublicArtistSlug = slug;
      })
      .addCase(fetchArticles.rejected, (state, action) => {
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
