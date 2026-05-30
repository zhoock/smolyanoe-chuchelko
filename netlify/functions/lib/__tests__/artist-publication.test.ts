import { describe, expect, test } from '@jest/globals';
import { isArtistPublishedFromSignals } from '../artist-publication-signals';

describe('artist-publication', () => {
  test('catalog includes artist only when there are published tracks', () => {
    expect(isArtistPublishedFromSignals({ hasPublishedTracks: true })).toBe(true);
    expect(isArtistPublishedFromSignals({ hasPublishedTracks: false })).toBe(false);
  });

  test('public albums without tracks do not publish profile to catalog', () => {
    expect(isArtistPublishedFromSignals({ hasPublishedTracks: false })).toBe(false);
  });
});
