/**
 * Селекторы для получения данных из Redux стейта языка.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from './langSlice';

// Базовый селектор - получает весь стейт языка
const selectLangState = (state: RootState) => state.lang;

// Мемоизированный селектор для текущего языка
export const selectCurrentLang = createSelector(
  [selectLangState],
  (lang): SupportedLang => lang.current
);
