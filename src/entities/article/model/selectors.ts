/**
 * Селекторы для получения данных из Redux стейта статей.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';

import type { ArticlesEntry } from './types';

// Базовый селектор - получает весь стейт статей
export const selectArticlesState = (state: RootState): Record<SupportedLang, ArticlesEntry> =>
  state.articles;

// Мемоизированный селектор для получения записи по языку
export const selectArticlesEntry = createSelector(
  [selectArticlesState, (_state: RootState, lang: SupportedLang) => lang],
  (articles, lang): ArticlesEntry => articles[lang]
);

// Мемоизированный селектор для статуса загрузки
export const selectArticlesStatus = createSelector(
  [selectArticlesEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry) => entry.status
);

// Мемоизированный селектор для ошибки
export const selectArticlesError = createSelector(
  [selectArticlesEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry) => entry.error
);

// Мемоизированный селектор для данных
export const selectArticlesData = createSelector(
  [selectArticlesEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry): IArticles[] => entry.data
);

// Мемоизированный селектор для поиска статьи по ID
export const selectArticleById = createSelector(
  [selectArticlesData, (_state: RootState, _lang: SupportedLang, articleId: string) => articleId],
  (articles, articleId) => articles.find((article) => article.articleId === articleId)
);
