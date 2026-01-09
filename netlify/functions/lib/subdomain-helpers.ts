/**
 * Утилиты для работы с пользовательскими поддоменами
 * Поддерживает как dev-окружение (localhost), так и production-домены
 */

import type { HandlerEvent } from '@netlify/functions';
import { query } from './db';

const DISABLE_FLAG = process.env.DISABLE_SUBDOMAIN_MULTI_TENANCY === 'true';
const ENABLE_FLAG = process.env.ENABLE_SUBDOMAIN_MULTI_TENANCY === 'true';

function getConfiguredBaseDomains(): string[] {
  const raw =
    process.env.SUBDOMAIN_BASE_DOMAINS ||
    process.env.SUBDOMAIN_BASE_DOMAIN ||
    process.env.PRIMARY_DOMAIN ||
    process.env.BASE_DOMAIN ||
    process.env.APP_BASE_DOMAIN ||
    '';

  const fromEnv = raw
    .split(',')
    .map((domain) =>
      domain
        .trim()
        .toLowerCase()
        .replace(/^www\./, '')
    )
    .filter(Boolean);

  if (fromEnv.length > 0) {
    return Array.from(new Set(fromEnv));
  }

  const derived: string[] = [];
  const siteUrl = process.env.SUBDOMAIN_BASE_URL || process.env.NETLIFY_SITE_URL || '';
  if (siteUrl) {
    try {
      const hostname = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, '');
      if (hostname) {
        derived.push(hostname);
      }
    } catch (error) {
      console.warn(
        '[subdomain-helpers] Не удалось распарсить SUBDOMAIN_BASE_URL/NETLIFY_SITE_URL',
        {
          siteUrl,
          error,
        }
      );
    }
  }

  return Array.from(new Set(derived)).filter(Boolean);
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.127.0.0.1')
  );
}

export function sanitizeSubdomainCandidate(candidate: string): string {
  return candidate
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/**
 * Проверяет, включен ли режим мультитенантности через поддомены
 */
export function isSubdomainMultiTenancyEnabled(): boolean {
  if (DISABLE_FLAG) {
    return false;
  }

  if (ENABLE_FLAG) {
    return true;
  }

  if (getConfiguredBaseDomains().length > 0) {
    return true;
  }

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

  const hostname = host.split(':')[0]?.toLowerCase().trim();
  if (!hostname) {
    return null;
  }

  if (isLocalHostname(hostname)) {
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
      const candidate = sanitizeSubdomainCandidate(parts[0]);
      return candidate || null;
    }
    return null;
  }

  const baseDomains = getConfiguredBaseDomains();
  if (baseDomains.length === 0) {
    return null;
  }

  for (const baseDomain of baseDomains) {
    const normalizedBase = baseDomain.toLowerCase();
    if (hostname === normalizedBase || hostname === `www.${normalizedBase}`) {
      return null;
    }

    const suffix = `.${normalizedBase}`;
    if (hostname.endsWith(suffix)) {
      const prefix = hostname.slice(0, -suffix.length);
      if (!prefix) {
        return null;
      }

      // Поддерживаем только одноуровневые поддомены (username.domain)
      const segments = prefix.split('.');
      if (segments.length > 1) {
        console.warn('[subdomain-helpers] Обнаружен многоуровневый поддомен, игнорируем', {
          hostname,
          prefix,
        });
        return null;
      }

      const candidate = sanitizeSubdomainCandidate(prefix);
      return candidate || null;
    }
  }

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
  const normalized = sanitizeSubdomainCandidate(subdomain);
  if (!normalized) {
    console.warn('[getUserIdBySubdomain] Некорректный subdomain', { subdomain });
    return null;
  }

  try {
    const result = await query<{ id: string; username: string | null; email: string }>(
      `SELECT id, username, email
       FROM users
       WHERE is_active = true
         AND (
           username = $1
           OR LOWER(split_part(email, '@', 1)) = $1
         )
       ORDER BY username = $1 DESC, updated_at DESC
       LIMIT 1`,
      [normalized]
    );

    if (result.rows.length > 0) {
      console.log(
        `✅ [getUserIdBySubdomain] Found user for subdomain "${normalized}": ${result.rows[0].email} → ${result.rows[0].id}`
      );
      return result.rows[0].id;
    }

    console.warn(`⚠️ [getUserIdBySubdomain] No user found for subdomain "${normalized}"`);
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
  // В dev/production режиме сначала проверяем поддомен (если включена мультитенантность)
  if (!isSubdomainMultiTenancyEnabled()) {
    return getUserIdFromToken(event);
  }

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
