import type { Location } from 'react-router-dom';

const DEFAULT_AFTER_AUTH = '/';

function pathOnly(pathWithQueryOrHash: string): string {
  const q = pathWithQueryOrHash.indexOf('?');
  const h = pathWithQueryOrHash.indexOf('#');
  const cut = Math.min(
    q === -1 ? pathWithQueryOrHash.length : q,
    h === -1 ? pathWithQueryOrHash.length : h
  );
  return pathWithQueryOrHash.slice(0, cut);
}

/** True if destination is auth UI — avoid loops after login. */
function isAuthDestination(pathWithQueryOrHash: string): boolean {
  const p = pathOnly(pathWithQueryOrHash);
  return p === '/auth' || p.startsWith('/auth/');
}

/**
 * Allows only same-site relative navigations (no open redirects).
 */
export function sanitizeReturnPath(candidate: string | null | undefined): string | null {
  if (candidate == null || candidate === '') return null;
  const s = candidate.trim();
  // Path-only relative URLs
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  if (s.includes('\\')) return null;
  if (isAuthDestination(s)) return null;

  try {
    const resolved = new URL(s, window.location.origin);
    if (resolved.origin !== window.location.origin) return null;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }
}

export function appendReturnTo(
  params: URLSearchParams,
  location: Pick<Location, 'pathname' | 'search'>
): void {
  const candidate = `${location.pathname}${location.search}`;
  const safe = sanitizeReturnPath(candidate);
  if (safe) params.set('returnTo', safe);
}

type BackgroundState = { backgroundLocation?: Location } | undefined;

export function resolvePostAuthDestination(options: {
  returnToSearchParam: string | null;
  routerState?: BackgroundState | null;
}): string {
  const fromQuery = sanitizeReturnPath(options.returnToSearchParam ?? null);
  if (fromQuery) return fromQuery;

  const bg = options.routerState?.backgroundLocation;
  if (bg) {
    const path = `${bg.pathname}${bg.search}${bg.hash}`;
    const safe = sanitizeReturnPath(path);
    if (safe) return safe;
  }

  return DEFAULT_AFTER_AUTH;
}
