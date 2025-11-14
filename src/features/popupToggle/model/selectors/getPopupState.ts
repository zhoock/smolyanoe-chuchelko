/**
 * Селекторы для получения данных из Redux стейта попапа.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';

// Базовый селектор - получает весь стейт попапа
export const getPopupState = (state: RootState) => state.popup;

// Мемоизированный селектор для проверки открыт ли попап
export const getIsPopupOpen = createSelector([getPopupState], (popup) => popup.isOpen);
