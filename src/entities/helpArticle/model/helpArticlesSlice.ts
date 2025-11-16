import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { getJSON } from '@shared/api/http';
import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';

import type { HelpArticleEntry, HelpArticlesState } from './types';

const createInitialEntry = (): HelpArticleEntry => ({
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
});

const initialState: HelpArticlesState = {
  en: createInitialEntry(),
  ru: createInitialEntry(),
};

export const fetchHelpArticles = createAsyncThunk<
  IArticles[],
  { lang: SupportedLang },
  { rejectValue: string; state: RootState }
>(
  'helpArticles/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    try {
      const articles = await getJSON<IArticles[]>(`help-articles-${lang}.json`, signal);
      return articles;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: ({ lang }, { getState }) => {
      const state = getState();
      const entry = state.helpArticles[lang];
      // Не запускаем, если уже загружается или уже загружено
      if (entry.status === 'loading' || entry.status === 'succeeded') {
        return false;
      }
      return true;
    },
  }
);

const helpArticlesSlice = createSlice({
  name: 'helpArticles',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHelpArticles.pending, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'loading';
        entry.error = null;
      })
      .addCase(fetchHelpArticles.fulfilled, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.data = action.payload;
        entry.status = 'succeeded';
        entry.error = null;
        entry.lastUpdated = Date.now();
      })
      .addCase(fetchHelpArticles.rejected, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'failed';
        entry.error = action.payload ?? action.error.message ?? 'Failed to fetch help articles';
      });
  },
});

export const helpArticlesReducer = helpArticlesSlice.reducer;
