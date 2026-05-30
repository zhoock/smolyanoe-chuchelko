import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  clearAlbumDeletedLeavePage,
  readAlbumDeletedLeavePage,
  shouldLeaveDeletedAlbumPage,
} from '@shared/lib/albumDeletedSession';
import { buildOwnArtistPagePath } from '@shared/lib/ownArtistPage';

/**
 * Скрывает «Album not found» и уводит с /albums/:id после удаления этого альбома из кабинета.
 */
export function useRedirectAfterDeletedAlbum(albumId: string, fallbackArtistSlug: string): boolean {
  const navigate = useNavigate();
  const shouldSuppress = shouldLeaveDeletedAlbumPage(albumId);

  useEffect(() => {
    if (!shouldSuppress) return;

    const payload = readAlbumDeletedLeavePage();
    const slug = payload?.artistSlug?.trim() || fallbackArtistSlug.trim();
    clearAlbumDeletedLeavePage();

    if (slug) {
      navigate(buildOwnArtistPagePath(slug), { replace: true });
      return;
    }

    navigate({ pathname: '/', search: '' }, { replace: true });
  }, [shouldSuppress, navigate, fallbackArtistSlug]);

  return shouldSuppress;
}
