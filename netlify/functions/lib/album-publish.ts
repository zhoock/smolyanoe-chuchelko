type AlbumPublishCheckRow = {
  album: string | null;
  cover: string | null;
  description: string | null;
  release: Record<string, unknown> | null;
  is_published: boolean;
};

function releaseString(release: Record<string, unknown> | null | undefined, key: string): string {
  const value = release?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function releaseGenreCodes(release: Record<string, unknown> | null | undefined): string[] {
  const raw = release?.genreCodes;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

export function isAlbumRowReadyToPublish(album: AlbumPublishCheckRow, trackCount: number): boolean {
  if (album.is_published) return false;
  if (!album.album?.trim()) return false;
  if (!album.cover?.trim()) return false;
  if (!album.description?.trim()) return false;
  if (trackCount < 1) return false;

  const release = (album.release ?? {}) as Record<string, unknown>;
  if (!releaseString(release, 'date')) return false;
  if (!releaseString(release, 'UPC')) return false;
  if (releaseGenreCodes(release).length === 0) return false;

  return true;
}
