import { describe, expect, test } from '@jest/globals';
import type { TracksProps } from '@models';

import {
  filterAlbumsForArtistPageSurface,
  hasVisitorVisibleArtistContent,
  isArtistProfileEmpty,
  needsArtistOnboarding,
  profileHasPublicBodyContent,
} from '../artistPageContent';

const mockTrack: TracksProps = {
  id: '1',
  title: 'Track',
  content: '',
  duration: 180,
  src: 'track.mp3',
  order_index: 10,
};

describe('artistPageContent', () => {
  test('needsArtistOnboarding only for completely empty artists', () => {
    expect(needsArtistOnboarding({ albumsCount: 0, articlesCount: 0, profileIsEmpty: true })).toBe(
      true
    );
    expect(needsArtistOnboarding({ albumsCount: 1, articlesCount: 0, profileIsEmpty: true })).toBe(
      false
    );
    expect(needsArtistOnboarding({ albumsCount: 0, articlesCount: 1, profileIsEmpty: true })).toBe(
      false
    );
    expect(needsArtistOnboarding({ albumsCount: 0, articlesCount: 0, profileIsEmpty: false })).toBe(
      false
    );
  });

  test('isArtistProfileEmpty checks profile fields', () => {
    expect(isArtistProfileEmpty({})).toBe(true);
    expect(isArtistProfileEmpty({ siteName: 'Band' })).toBe(false);
    expect(isArtistProfileEmpty({ headerImages: ['hero.jpg'] })).toBe(false);
    expect(isArtistProfileEmpty({ theBand: ['Bio'] })).toBe(false);
  });

  test('filterAlbumsForArtistPageSurface hides empty albums for visitors', () => {
    const albums = [
      {
        albumId: 'a1',
        album: 'Draft',
        artist: 'Band',
        fullName: 'Band — Draft',
        description: '',
        release: { date: '2024-01-01' },
        tracks: [],
        buttons: {},
        details: [],
        isPublic: false,
      },
      {
        albumId: 'a2',
        album: 'Public Empty',
        artist: 'Band',
        fullName: 'Band — Public Empty',
        description: '',
        release: { date: '2024-01-01' },
        tracks: [],
        buttons: {},
        details: [],
        isPublic: true,
      },
      {
        albumId: 'a3',
        album: 'Published',
        artist: 'Band',
        fullName: 'Band — Published',
        description: '',
        release: { date: '2024-01-01' },
        tracks: [mockTrack],
        buttons: {},
        details: [],
        isPublic: true,
      },
    ];

    expect(filterAlbumsForArtistPageSurface(albums, true)).toHaveLength(3);
    expect(filterAlbumsForArtistPageSurface(albums, false)).toHaveLength(1);
  });

  test('profileHasPublicBodyContent ignores site name alone', () => {
    expect(profileHasPublicBodyContent({ siteName: 'Band' })).toBe(false);
    expect(profileHasPublicBodyContent({ theBand: ['Bio'] })).toBe(true);
  });

  test('hasVisitorVisibleArtistContent accepts tracks, articles, or profile body', () => {
    expect(
      hasVisitorVisibleArtistContent({
        albums: [
          {
            album: 'Release',
            artist: 'Band',
            fullName: 'Band — Release',
            description: '',
            release: { date: '2024-01-01' },
            tracks: [mockTrack],
            buttons: {},
            details: [],
            isPublic: true,
          },
        ],
        articlesCount: 0,
        profileHasPublicBody: false,
      })
    ).toBe(true);

    expect(
      hasVisitorVisibleArtistContent({
        albums: [],
        articlesCount: 2,
        profileHasPublicBody: false,
      })
    ).toBe(true);

    expect(
      hasVisitorVisibleArtistContent({
        albums: [],
        articlesCount: 0,
        profileHasPublicBody: true,
      })
    ).toBe(true);

    expect(
      hasVisitorVisibleArtistContent({
        albums: [],
        articlesCount: 0,
        profileHasPublicBody: false,
      })
    ).toBe(false);
  });
});
