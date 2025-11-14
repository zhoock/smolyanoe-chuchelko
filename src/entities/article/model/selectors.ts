import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';

import type { ArticlesEntry } from './types';

export const selectArticlesState = (state: RootState): Record<SupportedLang, ArticlesEntry> =>
  state.articles;

export const selectArticlesEntry = (state: RootState, lang: SupportedLang): ArticlesEntry =>
  selectArticlesState(state)[lang];

export const selectArticlesStatus = (state: RootState, lang: SupportedLang) =>
  selectArticlesEntry(state, lang).status;

export const selectArticlesError = (state: RootState, lang: SupportedLang) =>
  selectArticlesEntry(state, lang).error;

export const selectArticlesData = (state: RootState, lang: SupportedLang): IArticles[] =>
  selectArticlesEntry(state, lang).data;

export const selectArticleById = (state: RootState, lang: SupportedLang, articleId: string) =>
  selectArticlesData(state, lang).find((article) => article.articleId === articleId);
