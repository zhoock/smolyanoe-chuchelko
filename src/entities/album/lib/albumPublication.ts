import type { IAlbums } from '@models';

/** Альбом прошёл одноразовую публикацию (не черновик). */
export function isAlbumPublished(album: Pick<IAlbums, 'isPublished' | 'isPublic'>): boolean {
  if (typeof album.isPublished === 'boolean') {
    return album.isPublished;
  }
  // Legacy до миграции 050: is_public=true означало «опубликован и видим»
  return album.isPublic === true;
}

/** Черновик — ещё не опубликован. */
export function isAlbumDraft(album: Pick<IAlbums, 'isPublished' | 'isPublic'>): boolean {
  return !isAlbumPublished(album);
}

/** Видимость на странице артиста (только для опубликованных альбомов). */
export function isAlbumVisibleOnArtistPage(
  album: Pick<IAlbums, 'isPublished' | 'isPublic'>
): boolean {
  return isAlbumPublished(album) && album.isPublic !== false;
}
