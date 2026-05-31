import type { IAlbums } from '@models';

import { isAlbumPublished } from './albumPublication';
import { isAlbumReadyToPublish } from './isAlbumReadyToPublish';

export type AlbumLifecycleStatus = 'draft' | 'ready-to-publish' | 'published' | 'hidden';

export function getAlbumLifecycleStatus(album: IAlbums): AlbumLifecycleStatus {
  if (isAlbumPublished(album)) {
    return album.isPublic === false ? 'hidden' : 'published';
  }

  if (isAlbumReadyToPublish(album)) {
    return 'ready-to-publish';
  }

  return 'draft';
}
