/**
 * Public-facing app origin for emails and browser redirects.
 * Never derive from request Host headers — Netlify dev URL (8888) is not the SPA origin.
 */

export const LOCAL_DEV_FRONTEND_ORIGIN = 'http://localhost:8080';

export function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

export function isLocalBackendOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return false;
    }
    return parsed.port === '8888';
  } catch {
    return false;
  }
}

/**
 * Origin users open in the browser (SPA + proxied /api on the same host in dev).
 * Priority: PUBLIC_APP_URL → NETLIFY_SITE_URL → URL → DEPLOY_PRIME_URL.
 * Local Netlify backend URLs (localhost:8888) are skipped; dev falls back to :8080.
 */
export function getPublicAppOrigin(): string {
  const candidates = [
    process.env.PUBLIC_APP_URL,
    process.env.NETLIFY_SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const raw of candidates) {
    const origin = normalizeOrigin(raw);
    if (!isLocalBackendOrigin(origin)) {
      return origin;
    }
  }

  return LOCAL_DEV_FRONTEND_ORIGIN;
}

export function buildEmailVerificationUrl(token: string): string {
  return `${getPublicAppOrigin()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Public SPA URL the password-reset email links to. The token must be the raw
 * (un-hashed) value that ships in the email — the server hashes it to look up
 * the user.
 */
export function buildPasswordResetUrl(token: string): string {
  return `${getPublicAppOrigin()}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildPublicAppPath(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getPublicAppOrigin()}${path}`;
}
