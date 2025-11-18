import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';

import type { ArticlesEntry, ArticlesState } from './types';

const createInitialEntry = (): ArticlesEntry => ({
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
});

const initialState: ArticlesState = {
  en: createInitialEntry(),
  ru: createInitialEntry(),
};

export const fetchArticles = createAsyncThunk<
  IArticles[],
  { lang: SupportedLang },
  { rejectValue: string; state: RootState }
>(
  'articles/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    try {
      // Загружаем из БД через API
      // Импортируем динамически, чтобы избежать циклических зависимостей
      const { getAuthHeader } = await import('@shared/lib/auth');
      const authHeader = getAuthHeader();

      const response = await fetch(`/api/articles-api?lang=${lang}`, {
        signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          ...authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch articles. Status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid response from API');
      }

      // Если данных нет, возвращаем пустой массив
      if (result.data.length === 0) {
        return [];
      }

      // Преобразуем данные из API в формат IArticles
      const articles: IArticles[] = result.data.map((article: any) => ({
        articleId: article.articleId,
        nameArticle: article.nameArticle,
        img: article.img,
        date: article.date,
        details: article.details || [],
        description: article.description || '',
      }));

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
        const entry = state[lang];
        entry.data = action.payload;
        entry.status = 'succeeded';
        entry.error = null;
        entry.lastUpdated = Date.now();
      })
      .addCase(fetchArticles.rejected, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'failed';
        entry.error = action.payload ?? action.error.message ?? 'Failed to fetch articles';
      });
  },
});

export const articlesReducer = articlesSlice.reducer;
