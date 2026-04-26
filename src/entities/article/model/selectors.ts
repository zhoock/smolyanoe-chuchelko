/**
 * Селекторы для получения данных из Redux стейта статей.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';
import type { IArticles } from '@models';

import { selectCurrentLang } from '@shared/model/lang/selectors';
import { resolveArticleForDisplay } from '../lib/resolveArticleDisplay';

import type { ArticlesState } from './types';

export const selectArticlesState = (state: RootState): ArticlesState => state.articles;

export const selectArticlesStatus = createSelector([selectArticlesState], (s) => s.status);

export const selectArticlesInFlightFetchContextKey = createSelector(
  [selectArticlesState],
  (s) => s.inFlightFetchContextKey
);

export const selectArticlesError = createSelector([selectArticlesState], (s) => s.error);

export const selectArticlesData = createSelector([selectArticlesState], (s): IArticles[] => s.data);

/** Для отображения: строки с fallback по `state.lang.current`. */
export const selectArticlesDataResolved = createSelector(
  [selectArticlesData, selectCurrentLang],
  (articles, lang): IArticles[] => articles.map((a) => resolveArticleForDisplay(a, lang))
);

export const selectArticleById = createSelector(
  [selectArticlesData, (_state: RootState, articleId: string) => articleId],
  (articles, articleId) => articles.find((article) => article.articleId === articleId)
);

export const selectArticleByIdResolved = createSelector(
  [selectArticlesDataResolved, (_state: RootState, articleId: string) => articleId],
  (articles, articleId) => articles.find((article) => article.articleId === articleId)
);
