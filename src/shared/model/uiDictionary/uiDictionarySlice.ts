import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { getJSON } from '@shared/api/http';
import type { SupportedLang } from '@shared/model/lang';
import type { IInterface } from '@models';
import type { RootState } from '@shared/model/appStore/types';

import type { UiDictionaryEntry, UiDictionaryState } from './types';

const createInitialEntry = (): UiDictionaryEntry => ({
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
});

const initialState: UiDictionaryState = {
  en: createInitialEntry(),
  ru: createInitialEntry(),
};

export const fetchUiDictionary = createAsyncThunk<
  IInterface[],
  { lang: SupportedLang },
  { rejectValue: string; state: RootState }
>(
  'uiDictionary/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    try {
      const dictionary = await getJSON<IInterface[]>(`${lang}.json`, signal);
      return dictionary;
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
      const entry = state.uiDictionary[lang];
      // Не запускаем, если уже загружается или уже загружено
      if (entry.status === 'loading' || entry.status === 'succeeded') {
        return false;
      }
      return true;
    },
  }
);

const uiDictionarySlice = createSlice({
  name: 'uiDictionary',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUiDictionary.pending, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'loading';
        entry.error = null;
      })
      .addCase(fetchUiDictionary.fulfilled, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.data = action.payload;
        entry.status = 'succeeded';
        entry.error = null;
        entry.lastUpdated = Date.now();
      })
      .addCase(fetchUiDictionary.rejected, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'failed';
        entry.error = action.payload ?? action.error.message ?? 'Failed to fetch UI dictionary';
      });
  },
});

export const uiDictionaryReducer = uiDictionarySlice.reducer;
