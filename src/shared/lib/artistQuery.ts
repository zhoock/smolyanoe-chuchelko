interface BuildApiUrlOptions {
  includeArtist?: boolean;
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
    const artist = getArtistFromSearch(window.location.search);
    if (artist) {
      query.set('artist', artist);
    }
  }

  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
