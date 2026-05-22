import { describe, expect, test } from '@jest/globals';
import { hasPublishedPublicReleases } from '../hasPublishedPublicReleases';
import type { IAlbums } from '@models';

describe('hasPublishedPublicReleases', () => {
  test('returns true only for public releases with a title', () => {
    const album: IAlbums = {
      album: 'My Release',
      artist: 'Band',
      fullName: 'Band — My Release',
      description: '',
      release: { date: '2024-01-01' },
      tracks: [],
      buttons: {},
      details: [],
      isPublic: true,
    };
    expect(hasPublishedPublicReleases([album])).toBe(true);
  });

  test('ignores private or untitled albums', () => {
    expect(
      hasPublishedPublicReleases([
        {
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
          album: '   ',
          artist: 'Band',
          fullName: 'Band',
          description: '',
          release: { date: '2024-01-01' },
          tracks: [],
          buttons: {},
          details: [],
          isPublic: true,
        },
      ])
    ).toBe(false);
  });
});
