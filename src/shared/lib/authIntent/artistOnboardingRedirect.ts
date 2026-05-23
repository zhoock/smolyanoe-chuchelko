/**
 * One-time redirect to owner onboarding after registration / first auth completion.
 */

export const FIRST_ARTIST_ONBOARDING_PENDING_KEY = 'sc_first_artist_onboarding_pending';

function normalizeUserId(userId: string | null | undefined): string {
  return userId?.trim() ?? '';
}

export function markFirstArtistOnboardingPending(userId: string): void {
  const id = normalizeUserId(userId);
  if (!id || typeof window === 'undefined') return;
  try {
    localStorage.setItem(FIRST_ARTIST_ONBOARDING_PENDING_KEY, id);
  } catch {
    /* ignore quota */
  }
}

export function hasFirstArtistOnboardingPending(userId: string): boolean {
  const id = normalizeUserId(userId);
  if (!id || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(FIRST_ARTIST_ONBOARDING_PENDING_KEY) === id;
  } catch {
    return false;
  }
}

export function clearFirstArtistOnboardingPending(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(FIRST_ARTIST_ONBOARDING_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
