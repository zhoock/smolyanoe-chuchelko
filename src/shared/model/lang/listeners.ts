import { createListenerMiddleware } from '@reduxjs/toolkit';

import { setLang as persistLang } from '@shared/lib/lang';

import { langActions, type SupportedLang } from './langSlice';

export const applyLangSideEffects = (lang: SupportedLang) => {
  persistLang(lang);

  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
};

export const langListenerMiddleware = createListenerMiddleware();

langListenerMiddleware.startListening({
  actionCreator: langActions.setLang,
  effect: async (action) => {
    applyLangSideEffects(action.payload);
  },
});
