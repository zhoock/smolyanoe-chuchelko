import {
  ALBUM_CHECKOUT_AUTH_INTENT_STORAGE_KEY,
  ALBUM_CHECKOUT_PENDING_KEY_STORAGE_KEY,
  ALBUM_CHECKOUT_RESUME_AFTER_AUTH_FLAG,
  beginAlbumCheckoutAuthIntent,
  clearAlbumCheckoutAuthIntent,
  consumePendingAlbumCheckoutForKey,
  markPendingAlbumCheckoutForKey,
  readAlbumCheckoutAuthIntent,
  shouldResumeAlbumCheckoutAfterAuth,
} from '../albumCheckoutIntent';

describe('albumCheckoutAuthIntent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('beginAlbumCheckoutAuthIntent saves intent and resume flag', () => {
    beginAlbumCheckoutAuthIntent({
      albumKey: 'rubber-soul',
      dbAlbumId: 'db-album-1',
      returnTo: '/albums/rubber-soul?artist=beatles',
    });

    const intent = readAlbumCheckoutAuthIntent();
    expect(intent?.type).toBe('album_checkout');
    expect(intent?.albumKey).toBe('rubber-soul');
    expect(intent?.dbAlbumId).toBe('db-album-1');
    expect(intent?.returnTo).toBe('/albums/rubber-soul?artist=beatles');
    expect(shouldResumeAlbumCheckoutAfterAuth()).toBe(true);
  });

  test('clearAlbumCheckoutAuthIntent removes intent and flag', () => {
    beginAlbumCheckoutAuthIntent({ albumKey: 'rubber-soul' });
    clearAlbumCheckoutAuthIntent();
    expect(readAlbumCheckoutAuthIntent()).toBeNull();
    expect(shouldResumeAlbumCheckoutAfterAuth()).toBe(false);
    expect(sessionStorage.getItem(ALBUM_CHECKOUT_AUTH_INTENT_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(ALBUM_CHECKOUT_RESUME_AFTER_AUTH_FLAG)).toBeNull();
  });

  test('rejects intent with missing albumKey', () => {
    sessionStorage.setItem(
      ALBUM_CHECKOUT_AUTH_INTENT_STORAGE_KEY,
      JSON.stringify({ type: 'album_checkout', createdAt: Date.now() })
    );
    expect(readAlbumCheckoutAuthIntent()).toBeNull();
  });

  test('rejects intent older than TTL', () => {
    const stale = {
      type: 'album_checkout',
      albumKey: 'rubber-soul',
      dbAlbumId: '',
      returnTo: '/albums/rubber-soul',
      createdAt: Date.now() - 60 * 60 * 1000,
    };
    sessionStorage.setItem(ALBUM_CHECKOUT_AUTH_INTENT_STORAGE_KEY, JSON.stringify(stale));
    expect(readAlbumCheckoutAuthIntent()).toBeNull();
  });

  test('pending-key consumes exactly once for matching album', () => {
    markPendingAlbumCheckoutForKey('rubber-soul');
    expect(sessionStorage.getItem(ALBUM_CHECKOUT_PENDING_KEY_STORAGE_KEY)).toBe('rubber-soul');
    expect(consumePendingAlbumCheckoutForKey('rubber-soul')).toBe(true);
    // Repeated consume on the same album should be a no-op
    expect(consumePendingAlbumCheckoutForKey('rubber-soul')).toBe(false);
    expect(sessionStorage.getItem(ALBUM_CHECKOUT_PENDING_KEY_STORAGE_KEY)).toBeNull();
  });

  test('pending-key does not consume for a different album', () => {
    markPendingAlbumCheckoutForKey('rubber-soul');
    expect(consumePendingAlbumCheckoutForKey('revolver')).toBe(false);
    // Original pending key still present for the right album
    expect(sessionStorage.getItem(ALBUM_CHECKOUT_PENDING_KEY_STORAGE_KEY)).toBe('rubber-soul');
  });
});
