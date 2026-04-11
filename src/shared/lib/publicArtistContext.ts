/**
 * Resolves public artist slug for API calls and detects when a public synced-lyrics/user-profile
 * request should be skipped (unauthenticated visitor without artist context).
 */

export async function resolvePublicArtistSlugForApi(
  override: string | null | undefined
): Promise<string | null> {
  const o = override?.trim();
  if (o) return o;
  try {
    const { getStore } = await import('@shared/model/appStore');
    const { selectPublicArtistSlug } = await import('@shared/model/currentArtist');
    return selectPublicArtistSlug(getStore().getState());
  } catch {
    return null;
  }
}

export function isDashboardPathname(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');
}

export async function hasBearerAuth(): Promise<boolean> {
  const { getAuthHeader } = await import('@shared/lib/auth');
  const h = getAuthHeader() as Record<string, string | undefined>;
  return !!(h.Authorization || h.authorization);
}

/** Публичная страница, гость без ?artist= в store — не дергаем API (иначе 400). JWT на публичной странице без slug всё ещё обслуживается бэкендом. */
export async function shouldSkipUnauthenticatedPublicArtistApi(
  resolvedSlug: string | null
): Promise<boolean> {
  if (isDashboardPathname()) return false;
  if (resolvedSlug?.trim()) return false;
  return !(await hasBearerAuth());
}
