import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { getLang } from '@shared/lib/lang';

export type SupportedLang = 'en' | 'ru';

const isSupportedLang = (lang: string): lang is SupportedLang => lang === 'en' || lang === 'ru';

const resolveInitialLang = (): SupportedLang => {
  const stored = getLang();
  return isSupportedLang(stored) ? stored : 'en';
};

export interface LangState {
  current: SupportedLang;
}

const initialState: LangState = {
  current: resolveInitialLang(),
};

const langSlice = createSlice({
  name: 'lang',
  initialState,
  reducers: {
    setLang(state, action: PayloadAction<SupportedLang>) {
      state.current = action.payload;
    },
  },
});

export const { actions: langActions, reducer: langReducer } = langSlice;

