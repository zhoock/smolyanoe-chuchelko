/**
 * Общие утилиты для Netlify Functions
 * Убирает дублирование кода между различными API endpoints
 */

import type { HandlerEvent } from '@netlify/functions';
import { extractUserIdFromToken } from './jwt';

/**
 * Стандартные CORS заголовки для всех API endpoints
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
} as const;

/**
 * Стандартный ответ для OPTIONS запросов (preflight)
 */
export function createOptionsResponse() {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: '',
  };
}

/**
 * Стандартный ответ об ошибке
 */
export function createErrorResponse(
  statusCode: number,
  error: string,
  headers: Record<string, string> = CORS_HEADERS
) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      success: false,
      error,
    }),
  };
}

/**
 * Стандартный успешный ответ
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  headers: Record<string, string> = CORS_HEADERS
) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

/**
 * Стандартный успешный ответ с сообщением
 */
export function createSuccessMessageResponse(
  message: string,
  statusCode: number = 200,
  headers: Record<string, string> = CORS_HEADERS
) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({
      success: true,
      message,
    }),
  };
}

/**
 * Валидация параметра языка
 */
export function validateLang(lang: string | undefined): lang is 'en' | 'ru' {
  return lang === 'en' || lang === 'ru';
}

/**
 * Извлекает user_id из Authorization header
 * @returns user_id или null, если токен невалиден или отсутствует
 */
export function getUserIdFromEvent(event: HandlerEvent): string | null {
  return extractUserIdFromToken(event.headers.authorization);
}

/**
 * Проверяет авторизацию пользователя
 * @returns user_id или null, если не авторизован
 */
export function requireAuth(event: HandlerEvent): string | null {
  return getUserIdFromEvent(event);
}

/**
 * Парсит JSON body с обработкой ошибок
 */
export function parseJsonBody<T>(body: string | null, defaultValue: T): T {
  if (!body) {
    return defaultValue;
  }
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    console.error('❌ Failed to parse JSON body:', error);
    return defaultValue;
  }
}

/**
 * Обработка ошибок с логированием
 */
export function handleError(
  error: unknown,
  context: string,
  defaultMessage: string = 'Unknown error'
): { statusCode: number; headers: Record<string, string>; body: string } {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  console.error(`❌ Error in ${context}:`, error);

  return createErrorResponse(500, errorMessage);
}
