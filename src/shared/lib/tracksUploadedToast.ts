export const TRACKS_UPLOADED_TOAST_KEY = 'sc-tracks-uploaded-toast';

export function queueTracksUploadedToast(message: string): void {
  try {
    sessionStorage.setItem(TRACKS_UPLOADED_TOAST_KEY, message);
  } catch {
    /* ignore */
  }
}

export function consumeTracksUploadedToast(): string | null {
  try {
    const message = sessionStorage.getItem(TRACKS_UPLOADED_TOAST_KEY);
    if (message) {
      sessionStorage.removeItem(TRACKS_UPLOADED_TOAST_KEY);
      return message;
    }
  } catch {
    /* ignore */
  }
  return null;
}
