import type { IAlbums } from '@models';

import { isAlbumReadyToPublish } from './isAlbumReadyToPublish';

export type AlbumLifecycleStatus = 'draft' | 'ready-to-publish' | 'published';

export function getAlbumLifecycleStatus(album: IAlbums): AlbumLifecycleStatus {
  const trackCount = album.tracks?.length ?? 0;

  if (album.isPublic !== false && trackCount > 0) {
    return 'published';
  }

  if (isAlbumReadyToPublish(album)) {
    return 'ready-to-publish';
  }

  return 'draft';
}
