export const PREMIUM_SUCCESS_MODAL_SHOWN_KEY = 'premium_success_modal_shown';
export const PREMIUM_SUCCESS_MODAL_PENDING_KEY = 'premium_success_modal_pending';
export const PREMIUM_CHECKOUT_ARTIST_SLUG_KEY = 'premium_checkout_artist_slug';

export function isPremiumSuccessModalShown(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PREMIUM_SUCCESS_MODAL_SHOWN_KEY) === 'true';
}

export function markPremiumSuccessModalShown(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREMIUM_SUCCESS_MODAL_SHOWN_KEY, 'true');
  sessionStorage.removeItem(PREMIUM_SUCCESS_MODAL_PENDING_KEY);
}

export function markPremiumCheckoutPending(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PREMIUM_SUCCESS_MODAL_PENDING_KEY, '1');
}

export function isPremiumCheckoutPending(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PREMIUM_SUCCESS_MODAL_PENDING_KEY) === '1';
}

export function savePremiumCheckoutArtistSlug(): void {
  if (typeof window === 'undefined') return;
  const slug = new URLSearchParams(window.location.search).get('artist')?.trim() ?? '';
  sessionStorage.setItem(PREMIUM_CHECKOUT_ARTIST_SLUG_KEY, slug);
}

export function readPremiumCheckoutArtistSlug(): string {
  if (typeof window === 'undefined') return '';
  return (
    sessionStorage.getItem(PREMIUM_CHECKOUT_ARTIST_SLUG_KEY)?.trim() ||
    new URLSearchParams(window.location.search).get('artist')?.trim() ||
    ''
  );
}
