import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { IInterface } from '@models';

import type { UiDictionaryEntry } from './types';

export const selectUiDictionaryState = (
  state: RootState
): Record<SupportedLang, UiDictionaryEntry> => state.uiDictionary;

export const selectUiDictionaryEntry = (state: RootState, lang: SupportedLang): UiDictionaryEntry =>
  selectUiDictionaryState(state)[lang];

export const selectUiDictionaryStatus = (state: RootState, lang: SupportedLang) =>
  selectUiDictionaryEntry(state, lang).status;

export const selectUiDictionaryError = (state: RootState, lang: SupportedLang) =>
  selectUiDictionaryEntry(state, lang).error;

export const selectUiDictionaryData = (state: RootState, lang: SupportedLang): IInterface[] =>
  selectUiDictionaryEntry(state, lang).data;

export const selectUiDictionaryFirst = (state: RootState, lang: SupportedLang): IInterface | null =>
  selectUiDictionaryData(state, lang)[0] ?? null;
