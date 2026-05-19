/**
 * Перезагрузить публичный каталог после изменения archive (add/remove).
 */
import type { AppDispatch } from '@shared/model/appStore/types';
import { fetchAlbums } from '@entities/album';
import { fetchArticles } from '@entities/article';

export function refreshPremiumContentForArchiveChange(
  dispatch: AppDispatch,
  publicArtistSlug?: string | null
): void {
  void dispatch(fetchAlbums({ force: true }));
  void dispatch(
    fetchArticles({
      force: true,
      publicArtistSlug: publicArtistSlug?.trim() || undefined,
    })
  );
}

/** @deprecated use refreshPremiumContentForArchiveChange */
export const refreshPremiumContentAfterArchiveUnlock = refreshPremiumContentForArchiveChange;

export const ARCHIVE_ARTIST_ADDED_EVENT = 'archive:artist-added';
export const ARCHIVE_ARTIST_REMOVED_EVENT = 'archive:artist-removed';
export const ARCHIVE_CHANGED_EVENT = 'archive:changed';

export function dispatchArchiveArtistAdded(artistUserId: string, publicArtistSlug?: string): void {
  if (typeof window === 'undefined') return;
  const detail = { artistUserId, publicArtistSlug };
  window.dispatchEvent(new CustomEvent(ARCHIVE_ARTIST_ADDED_EVENT, { detail }));
  window.dispatchEvent(
    new CustomEvent(ARCHIVE_CHANGED_EVENT, { detail: { ...detail, type: 'added' } })
  );
}

export function dispatchArchiveArtistRemoved(
  artistUserId: string,
  publicArtistSlug?: string
): void {
  if (typeof window === 'undefined') return;
  const detail = { artistUserId, publicArtistSlug };
  window.dispatchEvent(new CustomEvent(ARCHIVE_ARTIST_REMOVED_EVENT, { detail }));
  window.dispatchEvent(
    new CustomEvent(ARCHIVE_CHANGED_EVENT, { detail: { ...detail, type: 'removed' } })
  );
}

export const SUBSCRIPTION_ACTIVATED_EVENT = 'subscription:activated';

export function dispatchSubscriptionActivated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SUBSCRIPTION_ACTIVATED_EVENT));
  window.dispatchEvent(
    new CustomEvent(ARCHIVE_CHANGED_EVENT, { detail: { type: 'subscription' } })
  );
}
