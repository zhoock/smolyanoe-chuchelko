import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { hasPublishedPublicReleases } from '@entities/album/lib/hasPublishedPublicReleases';
import {
  selectAlbumsStatus,
  selectAlbumsFetchContextKey,
  selectCatalogArtistMissing,
  selectPublicAlbumsDataResolvedForSurface,
  selectPublicAlbumsCacheIsStale,
} from '@entities/album';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { buildPublicAlbumsFetchContextKey } from '@shared/lib/publicCatalogCacheKey';
import { fetchWithAuthSession } from '@shared/lib/authFetch';
import { getAuthHeader, isAuthenticated } from '@shared/lib/auth';

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
  const hasPublicReleases = useMemo(() => hasPublishedPublicReleases(publicAlbums), [publicAlbums]);

  const desiredFetchKey = useMemo(() => buildPublicAlbumsFetchContextKey(artistSlug), [artistSlug]);

  const [ownerResolved, setOwnerResolved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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
  }, [artistSlug, lang]);

  const albumsPending =
    catalogCacheStale ||
    albumsStatus === 'idle' ||
    albumsStatus === 'loading' ||
    (albumsStatus === 'succeeded' && albumsFetchContextKey !== desiredFetchKey);

  const isLoading = !ownerResolved || albumsPending;
  const showOnboarding = !isLoading && !catalogArtistMissing && !hasPublicReleases && isOwner;
  const showNotFound = !isLoading && (catalogArtistMissing || (!hasPublicReleases && !isOwner));
  const showPublished = !isLoading && !catalogArtistMissing && hasPublicReleases;

  return {
    isLoading,
    isOwner,
    hasPublicReleases,
    showOnboarding,
    showNotFound,
    showPublished,
  };
}
