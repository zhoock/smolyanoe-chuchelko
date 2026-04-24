import type { Location } from 'react-router-dom';

const STORAGE_KEY = 'sc-dashboard-modal-bg';

/**
 * Синхронно выставляется из Layout при рендере: при открытом дашборд-оверлее URL = /dashboard*,
 * но каталог альбомов в Redux должен оставаться в публичном контексте (как у страницы под модалкой),
 * иначе после закрытия меняется fetchContextKey и снова гоняется fetch.
 */
let dashboardAlbumsPublicCatalogOverlay = false;

export function syncDashboardAlbumsPublicCatalogOverlay(active: boolean): void {
  dashboardAlbumsPublicCatalogOverlay = active;
}

export function isDashboardAlbumsPublicCatalogOverlay(): boolean {
  return dashboardAlbumsPublicCatalogOverlay;
}

export type DashboardModalBackground = {
  pathname: string;
  search: string;
  hash: string;
};

/** Минимальный Location для `Routes location={…}` (модальный дашборд поверх другой страницы). */
export function locationFromDashboardModalStored(
  bg: DashboardModalBackground,
  key = 'dashboard-modal-bg'
): Location {
  return {
    pathname: bg.pathname,
    search: bg.search,
    hash: bg.hash,
    state: null,
    key,
  };
}

export function captureDashboardModalBackground(bg: DashboardModalBackground): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bg));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearDashboardModalBackground(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readDashboardModalBackground(): DashboardModalBackground | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<DashboardModalBackground>;
    if (typeof p.pathname !== 'string' || !p.pathname.startsWith('/')) return null;
    return {
      pathname: p.pathname,
      search: typeof p.search === 'string' ? p.search : '',
      hash: typeof p.hash === 'string' ? p.hash : '',
    };
  } catch {
    return null;
  }
}

/** Перед клиентским переходом на /dashboard-new с backgroundLocation — чтобы loader увидел фон до первого commit Layout. */
export function primeDashboardModalSessionFromLocation(current: Location): void {
  const nested = (current.state as { backgroundLocation?: Location } | null | undefined)
    ?.backgroundLocation;
  if (nested && !nested.pathname.startsWith('/dashboard')) {
    captureDashboardModalBackground({
      pathname: nested.pathname,
      search: nested.search,
      hash: nested.hash ?? '',
    });
    return;
  }
  if (!current.pathname.startsWith('/dashboard')) {
    captureDashboardModalBackground({
      pathname: current.pathname,
      search: current.search,
      hash: current.hash,
    });
  }
}

export function isDashboardModalOverNonDashboardBackground(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.location.pathname.startsWith('/dashboard')) return false;
  const bg = readDashboardModalBackground();
  if (!bg) return false;
  return !bg.pathname.startsWith('/dashboard');
}

/** Для albumsLoader: подменяем pathname/search на фон, если открыт модальный дашборд. */
export function resolveDashboardModalBackgroundForLoader(
  requestPathname: string,
  requestSearch: string
): { pathname: string; search: string } {
  if (!requestPathname.startsWith('/dashboard')) {
    return { pathname: requestPathname, search: requestSearch };
  }
  const bg = readDashboardModalBackground();
  if (bg && !bg.pathname.startsWith('/dashboard')) {
    return { pathname: bg.pathname, search: bg.search };
  }
  return { pathname: requestPathname, search: requestSearch };
}
