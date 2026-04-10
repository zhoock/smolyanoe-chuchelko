import type { IAlbums } from '@models';

/**
 * Клиентский ключ альбома для плеера / кэша. Предпочитает albumId с API.
 * Если albumId нет — временно сохраняем старый шаблон «artist-album» для совпадения с уже сохранённым playerState в localStorage (не для UI).
 */
export function fallbackAlbumClientId(
  album: Pick<IAlbums, 'albumId' | 'album' | 'userId' | 'artist'>
): string {
  if (album.albumId?.trim()) return album.albumId.trim();
  const art = (album.artist ?? '').trim();
  const title = (album.album ?? '').trim() || 'album';
  if (art) {
    return `${art}-${title}`.toLowerCase().replace(/\s+/g, '-');
  }
  const owner = (album.userId ?? '').trim() || 'na';
  return `${owner}-${title}`.toLowerCase().replace(/\s+/g, '-');
}
