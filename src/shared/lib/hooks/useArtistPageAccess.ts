import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { hasPublishedPublicReleases } from '@entities/album/lib/hasPublishedPublicReleases';
import {
  selectAlbumsStatus,
  selectAlbumsFetchContextKey,
  selectCatalogArtistMissing,
  selectPublicAlbumsDataResolvedForSurface,
  selectPublicAlbumsCacheIsStale,
  selectPublicCatalogCachedRowCount,
} from '@entities/album';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { buildPublicAlbumsFetchContextKey } from '@shared/lib/publicCatalogCacheKey';
import { fetchWithAuthSession } from '@shared/lib/authFetch';
import { getAuthHeader, getUser, isAuthenticated } from '@shared/lib/auth';
import { isCachedOwnArtistSlug, writeCachedOwnPublicSlug } from '@shared/lib/ownPublicSlugCache';

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Доступ к странице артиста: опубликованный каталог, onboarding владельца или 404.
 */
export function useArtistPageAccess(artistSlug: string) {
  const { lang } = useLang();
  const catalogArtistMissing = useAppSelector(selectCatalogArtistMissing);
  const albumsStatus = useAppSelector(selectAlbumsStatus);
  const albumsFetchContextKey = useAppSelector(selectAlbumsFetchContextKey);
  const catalogCacheStale = useAppSelector(selectPublicAlbumsCacheIsStale);
  const publicAlbums = useAppSelector(selectPublicAlbumsDataResolvedForSurface);
  const cachedPublicRowCount = useAppSelector(selectPublicCatalogCachedRowCount);
  const hasPublicReleases = useMemo(() => hasPublishedPublicReleases(publicAlbums), [publicAlbums]);

  const desiredFetchKey = useMemo(() => buildPublicAlbumsFetchContextKey(artistSlug), [artistSlug]);

  const cachedOwner = useMemo(() => {
    if (!isAuthenticated()) return false;
    return isCachedOwnArtistSlug(artistSlug, getUser()?.id);
  }, [artistSlug]);

  const [ownerResolved, setOwnerResolved] = useState(() => {
    const normalizedArtist = normalizeSlug(artistSlug);
    if (!normalizedArtist || !isAuthenticated()) return true;
    return cachedOwner;
  });
  const [isOwner, setIsOwner] = useState(cachedOwner);

  useEffect(() => {
    const normalizedArtist = normalizeSlug(artistSlug);
    if (!normalizedArtist) {
      setIsOwner(false);
      setOwnerResolved(true);
      return;
    }

    if (!isAuthenticated()) {
      setIsOwner(false);
      setOwnerResolved(true);
      return;
    }

    let cancelled = false;
    setIsOwner(cachedOwner);
    setOwnerResolved(cachedOwner);

    if (cachedOwner) {
      return () => {
        cancelled = true;
      };
    }

    setOwnerResolved(false);

    (async () => {
      try {
        const response = await fetchWithAuthSession(
          buildApiUrl('/api/user-profile', { lang }, { includeArtist: false }),
          {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              ...getAuthHeader(),
            },
          }
        );

        if (cancelled) return;

        if (!response.ok) {
          setIsOwner(false);
          return;
        }

        const result = (await response.json()) as {
          success?: boolean;
          data?: { publicSlug?: string | null };
        };
        const ownSlug = result.success ? normalizeSlug(result.data?.publicSlug ?? '') : '';
        const userId = getUser()?.id?.trim();
        if (ownSlug && userId) writeCachedOwnPublicSlug(userId, ownSlug);
        setIsOwner(Boolean(ownSlug) && ownSlug === normalizedArtist);
      } catch {
        if (!cancelled) setIsOwner(false);
      } finally {
        if (!cancelled) setOwnerResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artistSlug, cachedOwner, lang]);

  const albumsPending =
    catalogCacheStale ||
    albumsStatus === 'idle' ||
    (albumsStatus === 'loading' && cachedPublicRowCount === 0) ||
    (albumsStatus === 'succeeded' &&
      albumsFetchContextKey !== desiredFetchKey &&
      cachedPublicRowCount === 0);

  const isLoading = !ownerResolved || albumsPending;
  const showOnboarding = !isLoading && !catalogArtistMissing && !hasPublicReleases && isOwner;
  const showNotFound = !isLoading && (catalogArtistMissing || (!hasPublicReleases && !isOwner));
  const showPublished = !isLoading && !catalogArtistMissing && hasPublicReleases;
  const suppressPublishedArtistChrome =
    !hasPublicReleases && (isLoading || showOnboarding || showNotFound);

  return {
    isLoading,
    isOwner,
    hasPublicReleases,
    showOnboarding,
    showNotFound,
    showPublished,
    suppressPublishedArtistChrome,
  };
}
