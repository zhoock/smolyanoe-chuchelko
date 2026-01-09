/**
 * Клиентские утилиты для работы с пользовательскими поддоменами
 */

const rawEnv = (() => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return (import.meta as any).env as Record<string, string | undefined>;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {} as Record<string, string | undefined>;
})();

const disableFlag =
  rawEnv.VITE_DISABLE_SUBDOMAIN_MULTI_TENANCY === 'true' ||
  rawEnv.DISABLE_SUBDOMAIN_MULTI_TENANCY === 'true';
const enableFlag =
  rawEnv.VITE_ENABLE_SUBDOMAIN_MULTI_TENANCY === 'true' ||
  rawEnv.ENABLE_SUBDOMAIN_MULTI_TENANCY === 'true';

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.127.0.0.1')
  );
}

function getConfiguredBaseDomains(): string[] {
  const raw =
    rawEnv.VITE_SUBDOMAIN_BASE_DOMAINS ??
    rawEnv.SUBDOMAIN_BASE_DOMAINS ??
    rawEnv.VITE_SUBDOMAIN_BASE_DOMAIN ??
    rawEnv.SUBDOMAIN_BASE_DOMAIN ??
    rawEnv.VITE_PRIMARY_DOMAIN ??
    rawEnv.PRIMARY_DOMAIN ??
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

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (isLocalHostname(hostname)) {
      return [];
    }
    const parts = hostname.split('.');
    if (parts.length > 2) {
      parts.shift();
      return [parts.join('.')];
    }
    if (parts.length === 2) {
      return [hostname];
    }
  }

  return [];
}

export function sanitizeSubdomainCandidate(candidate: string): string {
  return candidate
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function extractSubdomainFromHostname(hostname?: string): string | null {
  if (!hostname) {
    return null;
  }

  const normalizedHost = hostname.toLowerCase();

  if (isLocalHostname(normalizedHost)) {
    const parts = normalizedHost.split('.');
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

  for (const base of baseDomains) {
    const normalizedBase = base.toLowerCase();
    if (normalizedHost === normalizedBase || normalizedHost === `www.${normalizedBase}`) {
      return null;
    }

    const suffix = `.${normalizedBase}`;
    if (normalizedHost.endsWith(suffix)) {
      const prefix = normalizedHost.slice(0, -suffix.length);
      if (!prefix) {
        return null;
      }

      const segments = prefix.split('.');
      if (segments.length > 1) {
        console.warn('[subdomain] Обнаружен многоуровневый поддомен, игнорируем', {
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
 * Проверяет, включен ли режим мультитенантности через поддомены
 */
export function isSubdomainMultiTenancyEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (disableFlag) {
    return false;
  }

  if (enableFlag) {
    return true;
  }

  if (getConfiguredBaseDomains().length > 0) {
    return true;
  }

  return isLocalHostname(window.location.hostname.toLowerCase());
}

/**
 * Извлекает текущий поддомен пользователя (если есть)
 */
export function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return extractSubdomainFromHostname(window.location.hostname);
}

function normalizePath(path: string): string {
  if (!path) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Создает URL для поддомена пользователя
 * @param subdomain - поддомен (например, "user1")
 * @param path - путь (например, "/dashboard")
 * @returns полный URL
 */
export function createSubdomainUrl(subdomain: string, path: string = '/'): string {
  const sanitized = sanitizeSubdomainCandidate(subdomain);
  if (!sanitized) {
    return normalizePath(path);
  }

  const normalizedPath = normalizePath(path);

  if (typeof window === 'undefined') {
    const [primaryDomain] = getConfiguredBaseDomains();
    if (primaryDomain) {
      return `https://${sanitized}.${primaryDomain}${normalizedPath}`;
    }
    return normalizedPath;
  }

  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol || 'https:';
  const port = window.location.port ? `:${window.location.port}` : '';

  if (isLocalHostname(hostname)) {
    return `${protocol}//${sanitized}.localhost${port}${normalizedPath}`;
  }

  const [primaryDomain] = getConfiguredBaseDomains();
  if (primaryDomain) {
    return `${protocol}//${sanitized}.${primaryDomain}${normalizedPath}`;
  }

  // Fallback: используем текущий hostname как базу
  return `${protocol}//${sanitized}.${hostname}${normalizedPath}`;
}

/**
 * Перенаправляет пользователя на его поддомен
 * @param subdomain - поддомен пользователя (из email/username)
 * @param path - путь для редиректа (по умолчанию текущий путь)
 */
export function redirectToSubdomain(subdomain: string, path?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const redirectPath = path || `${window.location.pathname}${window.location.search}`;
  const subdomainUrl = createSubdomainUrl(subdomain, redirectPath);
  console.log(`🔄 Redirecting to subdomain: ${subdomainUrl}`);
  window.location.href = subdomainUrl;
}
