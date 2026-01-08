/**
 * Утилиты для работы с поддоменами в dev режиме
 * Позволяет каждому пользователю иметь свой поддомен: user1.localhost:8888, user2.localhost:8888
 */

import type { HandlerEvent } from '@netlify/functions';
import { query } from './db';

/**
 * Проверяет, включен ли режим мультитенантности через поддомены
 * Включен только в dev режиме (NETLIFY_DEV=true)
 */
export function isSubdomainMultiTenancyEnabled(): boolean {
  return process.env.NETLIFY_DEV === 'true' || process.env.NODE_ENV === 'development';
}

/**
 * Извлекает subdomain из host заголовка
 * Примеры:
 * - "user1.localhost:8888" → "user1"
 * - "user2.localhost" → "user2"
 * - "localhost:8888" → null (главный домен)
 * - "smolyanoechuchelko.ru" → null (продакшн)
 */
export function extractSubdomainFromHost(host: string | undefined): string | null {
  if (!host) {
    return null;
  }

  // Убираем порт если есть
  const hostname = host.split(':')[0];

  // Проверяем, является ли это localhost (dev режим)
  if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
    return null; // Не dev режим, поддомены не используются
  }

  // Разделяем по точкам
  const parts = hostname.split('.');

  // Если первая часть не "localhost" и не "127", значит это subdomain
  // Пример: ["user1", "localhost"] → subdomain = "user1"
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    const subdomain = parts[0];
    // Проверяем, что это не просто "localhost"
    if (subdomain !== 'localhost' && subdomain !== '127' && subdomain.length > 0) {
      return subdomain;
    }
  }

  // Для 127.0.0.1 поддомены не поддерживаются (нет DNS)
  return null;
}

/**
 * Извлекает subdomain из события Netlify Function
 */
export function extractSubdomainFromEvent(event: HandlerEvent): string | null {
  const host = event.headers?.host || event.headers?.Host;
  return extractSubdomainFromHost(host);
}

/**
 * Находит userId по subdomain
 * Ищет пользователя в БД по части email (до @)
 *
 * @param subdomain - поддомен (например, "user1" для user1@example.com)
 * @returns userId или null если не найден
 */
export async function getUserIdBySubdomain(subdomain: string): Promise<string | null> {
  try {
    // Ищем пользователя по части email (до @)
    // Например: subdomain="user1" → ищем email LIKE "user1@%"
    const result = await query<{ id: string; email: string }>(
      `SELECT id, email 
       FROM users 
       WHERE email LIKE $1 
       LIMIT 1`,
      [`${subdomain}@%`]
    );

    if (result.rows.length > 0) {
      console.log(
        `✅ [getUserIdBySubdomain] Found user for subdomain "${subdomain}": ${result.rows[0].email} → ${result.rows[0].id}`
      );
      return result.rows[0].id;
    }

    console.warn(`⚠️ [getUserIdBySubdomain] No user found for subdomain "${subdomain}"`);
    return null;
  } catch (error) {
    console.error('❌ [getUserIdBySubdomain] Error querying database:', error);
    return null;
  }
}

/**
 * Получает userId из поддомена или из токена
 * В dev режиме сначала проверяет поддомен, затем токен
 * В продакшн режиме использует только токен
 */
export async function getUserIdFromSubdomainOrToken(
  event: HandlerEvent,
  getUserIdFromToken: (event: HandlerEvent) => string | null
): Promise<string | null> {
  // В продакшн режиме используем только токен
  if (!isSubdomainMultiTenancyEnabled()) {
    return getUserIdFromToken(event);
  }

  // В dev режиме сначала проверяем поддомен
  const subdomain = extractSubdomainFromEvent(event);
  if (subdomain) {
    const userId = await getUserIdBySubdomain(subdomain);
    if (userId) {
      console.log(
        `🏠 [getUserIdFromSubdomainOrToken] Using subdomain "${subdomain}" → userId: ${userId}`
      );
      return userId;
    } else {
      console.warn(
        `⚠️ [getUserIdFromSubdomainOrToken] Subdomain "${subdomain}" not found in database`
      );
    }
  }

  // Если поддомен не найден или не указан, используем токен
  return getUserIdFromToken(event);
}
