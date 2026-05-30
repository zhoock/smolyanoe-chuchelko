export const ALBUM_DELETED_TOAST_KEY = 'sc-album-deleted-toast';

export function queueAlbumDeletedToast(message: string): void {
  try {
    sessionStorage.setItem(ALBUM_DELETED_TOAST_KEY, message);
  } catch {
    /* ignore */
  }
}

export function consumeAlbumDeletedToast(): string | null {
  try {
    const message = sessionStorage.getItem(ALBUM_DELETED_TOAST_KEY);
    if (message) {
      sessionStorage.removeItem(ALBUM_DELETED_TOAST_KEY);
      return message;
    }
  } catch {
    /* ignore */
  }
  return null;
}
