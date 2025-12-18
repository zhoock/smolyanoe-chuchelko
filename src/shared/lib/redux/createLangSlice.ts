/**
 * Утилиты для создания Redux slices с поддержкой языков
 * Убирает дублирование кода между различными slices
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SupportedLang } from '@shared/model/lang';

/**
 * Базовый интерфейс для entry в state
 */
export interface BaseLangEntry<T> {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  data: T;
  lastUpdated: number | null;
}

/**
 * Создает начальное entry для языка
 */
export function createInitialLangEntry<T>(initialData: T): BaseLangEntry<T> {
  return {
    status: 'idle',
    error: null,
    data: initialData,
    lastUpdated: null,
  };
}

/**
 * Создает начальный state для всех языков
 */
export function createInitialLangState<T>(initialData: T): Record<SupportedLang, BaseLangEntry<T>> {
  return {
    en: createInitialLangEntry(initialData),
    ru: createInitialLangEntry(initialData),
  };
}

/**
 * Создает стандартные extraReducers для async thunk с языком
 */
export function createLangExtraReducers<
  TData,
  TState extends Record<SupportedLang, BaseLangEntry<TData>>,
>(
  thunk: { pending: any; fulfilled: any; rejected: any },
  errorMessage: string = 'Failed to fetch data'
) {
  return (builder: any) => {
    builder
      .addCase(
        thunk.pending,
        (
          state: TState,
          action: PayloadAction<unknown, string, { arg: { lang: SupportedLang } }>
        ) => {
          const { lang } = action.meta.arg;
          const entry = state[lang];
          entry.status = 'loading';
          entry.error = null;
        }
      )
      .addCase(
        thunk.fulfilled,
        (state: TState, action: PayloadAction<TData, string, { arg: { lang: SupportedLang } }>) => {
          const { lang } = action.meta.arg;
          // Создаем новый объект entry для гарантии обновления React
          const newData = Array.isArray(action.payload) ? [...action.payload] : action.payload;
          state[lang] = {
            ...state[lang],
            data: newData as TData,
            status: 'succeeded',
            error: null,
            lastUpdated: Date.now(),
          };
        }
      )
      .addCase(
        thunk.rejected,
        (
          state: TState,
          action: {
            meta: { arg: { lang: SupportedLang } };
            payload?: string;
            error?: { message?: string } | string;
          }
        ) => {
          const { lang } = action.meta.arg;
          const entry = state[lang];
          entry.status = 'failed';

          // Обрабатываем разные типы ошибок
          let errorText = errorMessage;
          if (action.payload) {
            errorText = action.payload;
          } else if (action.error) {
            if (typeof action.error === 'string') {
              errorText = action.error;
            } else if (
              action.error &&
              typeof action.error === 'object' &&
              'message' in action.error
            ) {
              errorText = action.error.message || errorMessage;
            }
          }

          entry.error = errorText;
        }
      );
  };
}
