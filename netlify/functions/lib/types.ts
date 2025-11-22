/**
 * Общие типы для Netlify Functions
 */

export type SupportedLang = 'en' | 'ru';

/**
 * Стандартный формат ответа API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Параметры запроса с языком
 */
export interface LangQueryParams {
  lang?: string;
}

/**
 * Параметры запроса с ID
 */
export interface IdQueryParams {
  id?: string;
}
