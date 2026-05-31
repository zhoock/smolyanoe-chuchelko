import { describe, expect, test } from '@jest/globals';

import { isAlbumDraft, isAlbumPublished, isAlbumVisibleOnArtistPage } from '../albumPublication';

describe('albumPublication', () => {
  test('isAlbumPublished uses isPublished when present', () => {
    expect(isAlbumPublished({ isPublished: true, isPublic: false })).toBe(true);
    expect(isAlbumPublished({ isPublished: false, isPublic: true })).toBe(false);
  });

  test('isAlbumPublished legacy fallback when isPublished is missing', () => {
    expect(isAlbumPublished({ isPublic: true })).toBe(true);
    expect(isAlbumPublished({ isPublic: false })).toBe(false);
  });

  test('isAlbumVisibleOnArtistPage requires published and visible', () => {
    expect(isAlbumVisibleOnArtistPage({ isPublished: true, isPublic: true })).toBe(true);
    expect(isAlbumVisibleOnArtistPage({ isPublished: true, isPublic: false })).toBe(false);
    expect(isAlbumVisibleOnArtistPage({ isPublished: false, isPublic: true })).toBe(false);
  });

  test('isAlbumDraft is inverse of published', () => {
    expect(isAlbumDraft({ isPublished: false, isPublic: false })).toBe(true);
    expect(isAlbumDraft({ isPublished: true, isPublic: false })).toBe(false);
  });
});
