import {
  clearFirstArtistOnboardingPending,
  FIRST_ARTIST_ONBOARDING_PENDING_KEY,
  hasFirstArtistOnboardingPending,
  markFirstArtistOnboardingPending,
} from '../artistOnboardingRedirect';

describe('artistOnboardingRedirect', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('markFirstArtistOnboardingPending stores user id', () => {
    markFirstArtistOnboardingPending('user-1');
    expect(localStorage.getItem(FIRST_ARTIST_ONBOARDING_PENDING_KEY)).toBe('user-1');
    expect(hasFirstArtistOnboardingPending('user-1')).toBe(true);
    expect(hasFirstArtistOnboardingPending('user-2')).toBe(false);
  });

  test('clearFirstArtistOnboardingPending removes pending flag', () => {
    markFirstArtistOnboardingPending('user-1');
    clearFirstArtistOnboardingPending();
    expect(hasFirstArtistOnboardingPending('user-1')).toBe(false);
  });
});
