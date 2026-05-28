const OWN_PUBLIC_SLUG_SESSION_KEY = 'sc_own_public_slug';

type CachedOwnPublicSlug = {
  userId: string;
  slug: string;
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function readCachedOwnPublicSlug(userId?: string | null): string | null {
  if (typeof window === 'undefined' || !userId?.trim()) return null;
  try {
    const raw = sessionStorage.getItem(OWN_PUBLIC_SLUG_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOwnPublicSlug;
    if (parsed.userId !== userId.trim()) return null;
    return parsed.slug?.trim() || null;
  } catch {
    return null;
  }
}

export function writeCachedOwnPublicSlug(userId: string, slug: string): void {
  const id = userId.trim();
  const normalizedSlug = slug.trim();
  if (!id || !normalizedSlug || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      OWN_PUBLIC_SLUG_SESSION_KEY,
      JSON.stringify({ userId: id, slug: normalizedSlug })
    );
  } catch {
    /* ignore quota */
  }
}

export function clearCachedOwnPublicSlug(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(OWN_PUBLIC_SLUG_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isCachedOwnArtistSlug(artistSlug: string, userId?: string | null): boolean {
  const cached = readCachedOwnPublicSlug(userId);
  if (!cached || !artistSlug.trim()) return false;
  return normalizeSlug(cached) === normalizeSlug(artistSlug);
}
