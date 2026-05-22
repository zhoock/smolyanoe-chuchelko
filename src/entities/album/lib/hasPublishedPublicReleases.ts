import type { IAlbums } from '@models';

/** Совпадает с правилом публикации профиля на бэкенде: public + непустое название релиза. */
export function hasPublishedPublicReleases(albums: IAlbums[]): boolean {
  return albums.some(
    (album) =>
      album.isPublic !== false && typeof album.album === 'string' && album.album.trim().length > 0
  );
}
