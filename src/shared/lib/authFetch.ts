/**
 * Обёртка над fetch для защищённых /api/*: синхронизация UI с 401 (истёкший JWT и т.д.).
 */
import { clearAuth, AUTH_EXPIRED_BANNER_SESSION_KEY } from './auth';

const AUTH_PATH_SUBSTRINGS = ['/api/auth/login', '/api/auth/register'];

/** Снижает гонки при нескольких параллельных 401 (один редирект / одна очистка баннера). */
let sessionExpiredRedirectScheduled = false;

function isAuthLoginOrRegisterUrl(url: string): boolean {
  return AUTH_PATH_SUBSTRINGS.some((s) => url.includes(s));
}

/** Был ли в init явно передан Bearer (чтобы не редиректить по чужим 401, например оплата). */
export function requestInitSentBearerToken(init?: RequestInit): boolean {
  if (!init?.headers) return false;
  const h = init.headers;
  if (typeof Headers !== 'undefined' && h instanceof Headers) {
    const a = h.get('Authorization') ?? h.get('authorization');
    return !!a && a.startsWith('Bearer ');
  }
  const rec = h as Record<string, string | undefined>;
  const a = rec.Authorization ?? rec.authorization;
  return !!a && String(a).startsWith('Bearer ');
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * fetch + обработка 401 от кастомного JWT API: очистка сессии и переход на /auth
 * (кроме логина/регистрации и ответов с code INVALID_CREDENTIALS).
 */
export async function fetchWithAuthSession(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status !== 401) {
    return response;
  }

  const url = resolveRequestUrl(input);
  if (isAuthLoginOrRegisterUrl(url)) {
    return response;
  }

  let code: string | undefined;
  try {
    const parsed = (await response.clone().json()) as { code?: string };
    code = parsed?.code;
  } catch {
    /* ignore */
  }

  if (code === 'INVALID_CREDENTIALS') {
    return response;
  }

  const hadBearer = requestInitSentBearerToken(init);

  const isSessionFailure =
    code === 'SESSION_EXPIRED' ||
    code === 'INVALID_SESSION' ||
    code === 'UNAUTHORIZED' ||
    (hadBearer && code === undefined);

  if (!isSessionFailure) {
    return response;
  }

  if (typeof window === 'undefined') {
    return response;
  }

  if (window.location.pathname.startsWith('/auth')) {
    clearAuth();
    return response;
  }

  if (!sessionExpiredRedirectScheduled) {
    sessionExpiredRedirectScheduled = true;
    try {
      sessionStorage.setItem(
        AUTH_EXPIRED_BANNER_SESSION_KEY,
        code === 'SESSION_EXPIRED'
          ? 'Session expired. Please sign in again.'
          : 'Your session is no longer valid. Please sign in again.'
      );
    } catch {
      /* ignore quota */
    }
  }

  clearAuth();
  window.location.assign('/auth');
  return response;
}
