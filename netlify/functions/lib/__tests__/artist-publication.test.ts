import { describe, expect, test } from '@jest/globals';
import { isArtistPublishedFromSignals } from '../artist-publication-signals';

describe('artist-publication', () => {
  test('profile is public only when there is a public album', () => {
    expect(isArtistPublishedFromSignals({ hasPublicAlbum: true })).toBe(true);
    expect(isArtistPublishedFromSignals({ hasPublicAlbum: false })).toBe(false);
  });

  test('articles, biography and hero image do not publish profile', () => {
    expect(isArtistPublishedFromSignals({ hasPublicAlbum: false })).toBe(false);
  });
});
