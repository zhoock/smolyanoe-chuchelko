import { describe, expect, test } from '@jest/globals';
import type { IAlbums } from '@models';

import { getAlbumLifecycleStatus } from '../albumLifecycleStatus';

describe('getAlbumLifecycleStatus', () => {
  const baseAlbum: IAlbums = {
    artist: '',
    album: 'Test Album',
    fullName: 'Test Album',
    description: 'Description',
    cover: 'album-cover-base',
    release: { date: '2020-01-01', UPC: '123', genreCodes: ['rock'] },
    buttons: {},
    details: [],
    tracks: [
      {
        id: '1',
        title: 'Track 1',
        content: '',
        duration: 180,
        src: 'track.mp3',
        order_index: 10,
      },
    ],
    isPublic: true,
    isPublished: true,
  };

  test('returns published when published', () => {
    expect(getAlbumLifecycleStatus(baseAlbum)).toBe('published');
  });

  test('returns hidden when published but not visible', () => {
    expect(getAlbumLifecycleStatus({ ...baseAlbum, isPublic: false, isPublished: true })).toBe(
      'hidden'
    );
  });

  test('returns draft when public but not published (legacy)', () => {
    expect(
      getAlbumLifecycleStatus({ ...baseAlbum, isPublic: true, isPublished: false, tracks: [] })
    ).toBe('draft');
  });

  test('returns published even without tracks when already published', () => {
    expect(getAlbumLifecycleStatus({ ...baseAlbum, tracks: [] })).toBe('published');
  });

  test('returns draft when unpublished and has no tracks', () => {
    expect(
      getAlbumLifecycleStatus({ ...baseAlbum, isPublic: false, isPublished: false, tracks: [] })
    ).toBe('draft');
  });
});
