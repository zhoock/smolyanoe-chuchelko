export const ALBUM_PUBLISHED_TOAST_KEY = 'sc-album-published-toast';

export function queueAlbumPublishedToast(): void {
  try {
    sessionStorage.setItem(ALBUM_PUBLISHED_TOAST_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeAlbumPublishedToast(): boolean {
  try {
    const v = sessionStorage.getItem(ALBUM_PUBLISHED_TOAST_KEY);
    if (v) {
      sessionStorage.removeItem(ALBUM_PUBLISHED_TOAST_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
