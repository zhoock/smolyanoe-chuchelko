import {
  beginPremiumCheckoutAuthIntent,
  clearPremiumCheckoutAuthIntent,
  readPremiumCheckoutAuthIntent,
  shouldResumePremiumCheckoutAfterAuth,
  PREMIUM_CHECKOUT_AUTH_INTENT_STORAGE_KEY,
  PREMIUM_CHECKOUT_RESUME_AFTER_AUTH_FLAG,
} from '../premiumCheckoutIntent';

describe('premiumCheckoutAuthIntent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('beginPremiumCheckoutAuthIntent saves intent and resume flag', () => {
    beginPremiumCheckoutAuthIntent({
      artistSlug: 'beatles',
      artistUserId: 'user-1',
      returnTo: '/albums/rubber-soul?artist=beatles',
    });

    const intent = readPremiumCheckoutAuthIntent();
    expect(intent?.type).toBe('premium_checkout');
    expect(intent?.artistSlug).toBe('beatles');
    expect(intent?.artistUserId).toBe('user-1');
    expect(intent?.returnTo).toBe('/albums/rubber-soul?artist=beatles');
    expect(shouldResumePremiumCheckoutAfterAuth()).toBe(true);
  });

  test('clearPremiumCheckoutAuthIntent removes intent and flag', () => {
    beginPremiumCheckoutAuthIntent();
    clearPremiumCheckoutAuthIntent();
    expect(readPremiumCheckoutAuthIntent()).toBeNull();
    expect(shouldResumePremiumCheckoutAfterAuth()).toBe(false);
    expect(sessionStorage.getItem(PREMIUM_CHECKOUT_AUTH_INTENT_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(PREMIUM_CHECKOUT_RESUME_AFTER_AUTH_FLAG)).toBeNull();
  });
});
