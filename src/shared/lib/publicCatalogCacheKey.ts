/** Ключ кэша публичного каталога альбомов (см. albumsLoader + fetchAlbums). */
export function buildPublicAlbumsFetchContextKey(publicSlug: string | null | undefined): string {
  const trimmed = publicSlug?.trim() ?? '';
  return trimmed ? `public:${trimmed}` : 'public:no-slug';
}
