import type { IAlbums } from '@models';

/**
 * Ключ альбома для `/api/yookassa-shop-id` и `create-payment`: canonical `albums.album_id` (slug).
 */
export function getAlbumKeyForPaymentApis(album: IAlbums): string | undefined {
  const slug = album.albumId?.trim();
  if (slug) {
    return slug;
  }
  return album.dbAlbumId?.trim() || undefined;
}
