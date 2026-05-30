const ALBUM_DELETED_LEAVE_KEY = 'sc-album-deleted-leave';

export type AlbumDeletedLeavePayload = {
  albumId: string;
  artistSlug: string;
};

export function markAlbumDeletedLeavePage(payload: AlbumDeletedLeavePayload): void {
  try {
    sessionStorage.setItem(ALBUM_DELETED_LEAVE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readAlbumDeletedLeavePage(): AlbumDeletedLeavePayload | null {
  try {
    const raw = sessionStorage.getItem(ALBUM_DELETED_LEAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AlbumDeletedLeavePayload>;
    const albumId = parsed.albumId?.trim();
    const artistSlug = parsed.artistSlug?.trim();
    if (!albumId || !artistSlug) return null;
    return { albumId, artistSlug };
  } catch {
    return null;
  }
}

export function shouldLeaveDeletedAlbumPage(albumId: string): boolean {
  const payload = readAlbumDeletedLeavePage();
  return payload?.albumId === albumId;
}

export function clearAlbumDeletedLeavePage(): void {
  try {
    sessionStorage.removeItem(ALBUM_DELETED_LEAVE_KEY);
  } catch {
    /* ignore */
  }
}
