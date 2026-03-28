interface BuildApiUrlOptions {
  includeArtist?: boolean;
  /**
   * When the URL has no `?artist=` (e.g. home `/`), use this public slug so API resolves
   * the playing artist. Needed so logged-in admins still load the correct user's synced
   * lyrics (backend would otherwise use JWT user id).
   */
  artistSlugOverride?: string | null;
}

function getArtistFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const artist = params.get('artist');
  if (!artist) {
    return null;
  }

  const normalized = artist.trim();
  return normalized.length > 0 ? normalized : null;
}

function shouldIncludeArtistOnCurrentPage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Не вмешиваем artist в админ-потоки.
  return !window.location.pathname.startsWith('/dashboard');
}

export function buildApiUrl(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  options: BuildApiUrlOptions = {}
): string {
  const includeArtist = options.includeArtist ?? false;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  }

  if (includeArtist && shouldIncludeArtistOnCurrentPage() && typeof window !== 'undefined') {
    const fromUrl = getArtistFromSearch(window.location.search);
    const slug =
      (fromUrl && fromUrl.trim()) ||
      (options.artistSlugOverride && String(options.artistSlugOverride).trim()) ||
      null;
    if (slug) {
      query.set('artist', slug);
    }
  }

  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
