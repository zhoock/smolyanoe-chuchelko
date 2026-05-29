import type { IAlbums } from '@models';

function releaseString(release: Record<string, unknown>, key: string): string {
  const value = release?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function releaseGenreCodes(release: Record<string, unknown>): string[] {
  const raw = release?.genreCodes;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

export function isAlbumDraft(album: Pick<IAlbums, 'isPublic'>): boolean {
  return album.isPublic === false;
}

/** Черновик можно опубликовать: обязательные поля из мастера + минимум один трек. */
export function isAlbumReadyToPublish(album: IAlbums): boolean {
  if (!isAlbumDraft(album)) return false;
  if (!album.album?.trim()) return false;
  if (!album.description?.trim()) return false;
  if ((album.tracks?.length ?? 0) < 1) return false;

  const release = (album.release ?? {}) as Record<string, unknown>;
  if (!releaseString(release, 'date')) return false;
  if (!releaseString(release, 'UPC')) return false;
  if (releaseGenreCodes(release).length === 0) return false;

  return true;
}
