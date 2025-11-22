import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangState, createLangExtraReducers } from '@shared/lib/redux/createLangSlice';

import type { ArticlesState } from './types';

const initialState: ArticlesState = createInitialLangState<IArticles[]>([]);

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
      const articles: IArticles[] = result.data.map(
        (article: {
          articleId: string;
          nameArticle: string;
          img: string;
          date: string;
          details?: unknown[];
          description?: string;
        }) => ({
          articleId: article.articleId,
          nameArticle: article.nameArticle,
          img: article.img,
          date: article.date,
          details: article.details || [],
          description: article.description || '',
        })
      );

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
  extraReducers: createLangExtraReducers(fetchArticles, 'Failed to fetch articles'),
});

export const articlesReducer = articlesSlice.reducer;
