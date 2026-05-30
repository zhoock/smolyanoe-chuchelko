import type { IAlbums } from '@models';

/** Public catalog eligibility: public release with at least one visible track. */
export function hasPublishedPublicReleases(albums: IAlbums[]): boolean {
  return albums.some(
    (album) =>
      album.isPublic !== false &&
      typeof album.album === 'string' &&
      album.album.trim().length > 0 &&
      (album.tracks?.length ?? 0) > 0
  );
}
