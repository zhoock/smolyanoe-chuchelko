import { describe, expect, test } from '@jest/globals';
import type { IAlbums } from '@models';

import { getAlbumLifecycleStatus } from '../albumLifecycleStatus';

describe('getAlbumLifecycleStatus', () => {
  const baseAlbum: IAlbums = {
    artist: '',
    album: 'Test Album',
    fullName: 'Test Album',
    description: 'Description',
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
  };

  test('returns published when public and has tracks', () => {
    expect(getAlbumLifecycleStatus(baseAlbum)).toBe('published');
  });

  test('returns draft when public but has no tracks', () => {
    expect(getAlbumLifecycleStatus({ ...baseAlbum, tracks: [] })).toBe('draft');
  });

  test('returns draft when private and has no tracks', () => {
    expect(getAlbumLifecycleStatus({ ...baseAlbum, isPublic: false, tracks: [] })).toBe('draft');
  });
});
