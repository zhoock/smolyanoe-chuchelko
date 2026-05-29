export const ALBUM_CREATED_TOAST_KEY = 'sc-album-created-toast';

export function queueAlbumCreatedToast(): void {
  try {
    sessionStorage.setItem(ALBUM_CREATED_TOAST_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeAlbumCreatedToast(): boolean {
  try {
    const v = sessionStorage.getItem(ALBUM_CREATED_TOAST_KEY);
    if (v) {
      sessionStorage.removeItem(ALBUM_CREATED_TOAST_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
