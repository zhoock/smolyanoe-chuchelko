/**
 * Клиентские утилиты для работы с поддоменами в dev режиме
 */

/**
 * Проверяет, включен ли режим мультитенантности через поддомены
 */
export function isSubdomainMultiTenancyEnabled(): boolean {
  // В dev режиме включаем поддомены, в продакшн - нет
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1'))
  );
}

/**
 * Извлекает subdomain из текущего hostname
 * Примеры:
 * - "user1.localhost:8888" → "user1"
 * - "user2.localhost" → "user2"
 * - "localhost:8888" → null (главный домен)
 */
export function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const hostname = window.location.hostname;

  // Проверяем, является ли это localhost (dev режим)
  if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
    return null; // Не dev режим, поддомены не используются
  }

  // Разделяем по точкам
  const parts = hostname.split('.');

  // Если первая часть не "localhost" и не "127", значит это subdomain
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    const subdomain = parts[0];
    if (subdomain !== 'localhost' && subdomain !== '127' && subdomain.length > 0) {
      return subdomain;
    }
  }

  return null;
}

/**
 * Создает URL для поддомена пользователя
 * @param subdomain - поддомен (например, "user1")
 * @param path - путь (например, "/dashboard")
 * @returns полный URL (например, "http://user1.localhost:8888/dashboard")
 */
export function createSubdomainUrl(subdomain: string, path: string = '/'): string {
  if (typeof window === 'undefined') {
    return path;
  }

  const port = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;
  return `${protocol}//${subdomain}.localhost${port}${path}`;
}

/**
 * Перенаправляет пользователя на его поддомен
 * @param subdomain - поддомен пользователя (из email до @)
 * @param path - путь для редиректа (по умолчанию текущий путь)
 */
export function redirectToSubdomain(subdomain: string, path?: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const redirectPath = path || window.location.pathname + window.location.search;
  const subdomainUrl = createSubdomainUrl(subdomain, redirectPath);
  console.log(`🔄 Redirecting to subdomain: ${subdomainUrl}`);
  window.location.href = subdomainUrl;
}
