export const ACCOUNT_DELETED_TOAST_KEY = 'sc-account-deleted-toast';

export function queueAccountDeletedToast(): void {
  try {
    sessionStorage.setItem(ACCOUNT_DELETED_TOAST_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function consumeAccountDeletedToast(): boolean {
  try {
    const v = sessionStorage.getItem(ACCOUNT_DELETED_TOAST_KEY);
    if (v) {
      sessionStorage.removeItem(ACCOUNT_DELETED_TOAST_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
