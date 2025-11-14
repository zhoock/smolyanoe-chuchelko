/**
 * Селекторы для получения данных из Redux стейта UI-словаря.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { IInterface } from '@models';

import type { UiDictionaryEntry } from './types';

// Базовый селектор - получает весь стейт UI-словаря
export const selectUiDictionaryState = (
  state: RootState
): Record<SupportedLang, UiDictionaryEntry> => state.uiDictionary;

// Мемоизированный селектор для получения записи по языку
export const selectUiDictionaryEntry = createSelector(
  [selectUiDictionaryState, (_state: RootState, lang: SupportedLang) => lang],
  (uiDictionary, lang): UiDictionaryEntry => uiDictionary[lang]
);

// Мемоизированный селектор для статуса загрузки
export const selectUiDictionaryStatus = createSelector(
  [selectUiDictionaryEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry) => entry.status
);

// Мемоизированный селектор для ошибки
export const selectUiDictionaryError = createSelector(
  [selectUiDictionaryEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry) => entry.error
);

// Мемоизированный селектор для данных
export const selectUiDictionaryData = createSelector(
  [selectUiDictionaryEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry): IInterface[] => entry.data
);

// Мемоизированный селектор для первого элемента
export const selectUiDictionaryFirst = createSelector(
  [selectUiDictionaryData, (_state: RootState, lang: SupportedLang) => lang],
  (data): IInterface | null => data[0] ?? null
);
