/**
 * Общие утилиты для Netlify Functions
 * Убирает дублирование кода между различными API endpoints
 */

import type { HandlerEvent } from '@netlify/functions';
import { extractUserIdFromToken } from './jwt';
import {
  isSubdomainMultiTenancyEnabled,
  extractSubdomainFromEvent,
  getUserIdBySubdomain,
} from './subdomain-helpers';

/**
 * Стандартные CORS заголовки для всех API endpoints
 *
 * ВАЖНО: В продакшене лучше использовать конкретный домен вместо '*'
 * для избежания проблем с CORS при использовании Authorization header.
 * Например: 'Access-Control-Allow-Origin': 'https://smolyanoechuchelko.ru'
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  // Предотвращаем кэширование ответов API
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
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
 * Netlify может передавать заголовок в разных регистрах (authorization, Authorization)
 * Также проверяем clientContext для Identity функций
 * @returns user_id или null, если токен невалиден или отсутствует
 */
export function getUserIdFromEvent(event: HandlerEvent): string | null {
  // Проверяем все возможные варианты регистра заголовка
  const auth =
    (event.headers?.authorization as string | undefined) ||
    (event.headers?.Authorization as string | undefined) ||
    // Проверяем clientContext для Netlify Identity функций
    ((event as any).clientContext?.user?.token as string | undefined);

  return extractUserIdFromToken(auth);
}

/**
 * Получает user_id из поддомена (dev режим) или из токена
 * В dev режиме сначала проверяет поддомен, затем токен
 * В продакшн режиме использует только токен
 * @returns user_id или null
 */
export async function getUserIdFromSubdomainOrEvent(event: HandlerEvent): Promise<string | null> {
  // В продакшн режиме используем только токен
  if (!isSubdomainMultiTenancyEnabled()) {
    return getUserIdFromEvent(event);
  }

  // В dev режиме сначала проверяем поддомен
  const subdomain = extractSubdomainFromEvent(event);
  if (subdomain) {
    const userId = await getUserIdBySubdomain(subdomain);
    if (userId) {
      console.log(
        `🏠 [getUserIdFromSubdomainOrEvent] Using subdomain "${subdomain}" → userId: ${userId}`
      );
      return userId;
    } else {
      console.warn(
        `⚠️ [getUserIdFromSubdomainOrEvent] Subdomain "${subdomain}" not found in database`
      );
    }
  }

  // Если поддомен не найден или не указан, используем токен
  return getUserIdFromEvent(event);
}

/**
 * Проверяет авторизацию пользователя
 * @returns user_id или null, если не авторизован
 */
export function requireAuth(event: HandlerEvent): string | null {
  const userId = getUserIdFromEvent(event);

  if (!userId) {
    // Детальное логирование для отладки проблем с авторизацией
    console.warn('⚠️ requireAuth: Authorization failed', {
      method: event.httpMethod,
      path: event.path,
      hasHeaders: !!event.headers,
      headerKeys: event.headers ? Object.keys(event.headers) : [],
      authorizationHeader:
        event.headers?.authorization || event.headers?.Authorization || 'not found',
      authorizationHeaderLength: (
        event.headers?.authorization ||
        event.headers?.Authorization ||
        ''
      ).length,
      clientContext: (event as any).clientContext ? 'present' : 'not present',
    });
  }

  return userId;
}

/**
 * Парсит JSON body с обработкой ошибок
 * @throws {Error} Если JSON невалиден, выбрасывает ошибку для возврата 400
 */
export function parseJsonBody<T>(body: string | null, defaultValue: T): T {
  if (!body) {
    return defaultValue;
  }
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    console.error('❌ Failed to parse JSON body:', error);
    const errorMessage = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Invalid JSON body: ${errorMessage}`);
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

  // Проверяем, является ли ошибка проблемой сетевого подключения
  const isNetworkError =
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('Connection terminated') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('MaxClientsInSessionMode');

  // Если это сетевая ошибка, возвращаем более понятное сообщение
  const userMessage = isNetworkError
    ? 'Database connection failed. This may be due to network restrictions. Please try using a VPN or check your network settings.'
    : errorMessage;

  return createErrorResponse(500, userMessage);
}
