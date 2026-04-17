import type { IAlbums } from '@models';

/**
 * Ключ альбома для `/api/yookassa-shop-id` и `create-payment`: UUID строки в БД или `album_id` (slug).
 */
export function getAlbumKeyForPaymentApis(album: IAlbums): string | undefined {
  const fromPk = album.dbAlbumId?.trim();
  if (fromPk) {
    return fromPk;
  }
  const slug = album.albumId?.trim();
  return slug || undefined;
}
