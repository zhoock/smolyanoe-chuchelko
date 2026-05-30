import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { hasPublishedPublicReleases } from '@entities/album/lib/hasPublishedPublicReleases';
import {
  selectAlbumsStatus,
  selectAlbumsData,
  selectAlbumsFetchContextKey,
  selectCatalogArtistMissing,
  selectDashboardAlbumsData,
  selectPublicAlbumsDataResolvedForSurface,
  selectPublicAlbumsCacheIsStale,
  selectPublicCatalogCachedRowCount,
} from '@entities/album';
import {
  selectArticlesStatus,
  selectArticlesDataResolvedForSurface,
  selectArticlesCacheIsStale,
} from '@entities/article';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { buildPublicAlbumsFetchContextKey } from '@shared/lib/publicCatalogCacheKey';
import { fetchWithAuthSession } from '@shared/lib/authFetch';
import { getAuthHeader, getUser, isAuthenticated } from '@shared/lib/auth';
import { isCachedOwnArtistSlug, writeCachedOwnPublicSlug } from '@shared/lib/ownPublicSlugCache';
import {
  countUniqueAlbums,
  countUniqueArticles,
  hasVisitorVisibleArtistContent,
  profileHasPublicBodyContent,
} from '@shared/lib/artistPageContent';
import { fetchOwnArtistPageState } from '@shared/lib/ownArtistPage';

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Доступ к странице артиста: каталог по опубликованным трекам, onboarding только для новых артистов, 404 без публичного контента.
 */
export function useArtistPageAccess(artistSlug: string) {
  const { lang } = useLang();
  const catalogArtistMissing = useAppSelector(selectCatalogArtistMissing);
  const albumsStatus = useAppSelector(selectAlbumsStatus);
  const albumsFetchContextKey = useAppSelector(selectAlbumsFetchContextKey);
  const catalogCacheStale = useAppSelector(selectPublicAlbumsCacheIsStale);
  const publicAlbums = useAppSelector(selectPublicAlbumsDataResolvedForSurface);
  const catalogAlbums = useAppSelector(selectAlbumsData);
  const dashboardAlbums = useAppSelector(selectDashboardAlbumsData);
  const cachedPublicRowCount = useAppSelector(selectPublicCatalogCachedRowCount);
  const articlesStatus = useAppSelector(selectArticlesStatus);
  const articlesCacheStale = useAppSelector(selectArticlesCacheIsStale);
  const publicArticles = useAppSelector(selectArticlesDataResolvedForSurface);
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
  const [ownerNeedsOnboarding, setOwnerNeedsOnboarding] = useState(false);
  const [ownerContentLoaded, setOwnerContentLoaded] = useState(false);
  const [visitorProfileHasPublicBody, setVisitorProfileHasPublicBody] = useState<boolean | null>(
    null
  );

  const ownerAlbumCount = useMemo(() => {
    if (!isOwner) return 0;
    return Math.max(countUniqueAlbums(dashboardAlbums), countUniqueAlbums(catalogAlbums));
  }, [isOwner, dashboardAlbums, catalogAlbums]);

  const ownerStillNeedsOnboarding = ownerNeedsOnboarding && ownerAlbumCount === 0;

  const ownerArticleCount = useMemo(() => {
    if (!isOwner) return 0;
    return countUniqueArticles(publicArticles);
  }, [isOwner, publicArticles]);

  const ownerStoreHasNoReleases = isOwner && ownerAlbumCount === 0 && ownerArticleCount === 0;

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

  useEffect(() => {
    if (!isOwner || !ownerResolved) {
      setOwnerContentLoaded(!isOwner);
      setOwnerNeedsOnboarding(false);
      return;
    }

    let cancelled = false;

    const refreshOwnerState = () => {
      setOwnerContentLoaded(false);
      void fetchOwnArtistPageState(lang).then((state) => {
        if (cancelled) return;
        setOwnerNeedsOnboarding(state.needsOnboarding);
        setOwnerContentLoaded(true);
      });
    };

    refreshOwnerState();

    window.addEventListener('artist:updated', refreshOwnerState);
    window.addEventListener('profile-name-updated', refreshOwnerState);

    return () => {
      cancelled = true;
      window.removeEventListener('artist:updated', refreshOwnerState);
      window.removeEventListener('profile-name-updated', refreshOwnerState);
    };
  }, [isOwner, ownerResolved, lang]);

  useEffect(() => {
    const normalizedArtist = normalizeSlug(artistSlug);
    if (isOwner || !ownerResolved || !normalizedArtist) {
      setVisitorProfileHasPublicBody(null);
      return;
    }

    let cancelled = false;
    setVisitorProfileHasPublicBody(null);

    void (async () => {
      try {
        const response = await fetchWithAuthSession(
          buildApiUrl(
            '/api/user-profile',
            { lang },
            { includeArtist: true, artistSlugOverride: normalizedArtist }
          ),
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
          setVisitorProfileHasPublicBody(false);
          return;
        }

        const result = (await response.json()) as {
          success?: boolean;
          data?: {
            theBand?: string[];
            headerImages?: string[];
            socialLinks?: Record<string, string | undefined>;
          };
        };

        setVisitorProfileHasPublicBody(
          result.success
            ? profileHasPublicBodyContent({
                theBand: result.data?.theBand,
                headerImages: result.data?.headerImages,
                socialLinks: result.data?.socialLinks,
              })
            : false
        );
      } catch {
        if (!cancelled) setVisitorProfileHasPublicBody(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artistSlug, isOwner, lang, ownerResolved]);

  const albumsPending =
    catalogCacheStale ||
    albumsStatus === 'idle' ||
    (albumsStatus === 'loading' && cachedPublicRowCount === 0) ||
    (albumsStatus === 'succeeded' &&
      albumsFetchContextKey !== desiredFetchKey &&
      cachedPublicRowCount === 0);

  const articlesPending =
    articlesCacheStale || articlesStatus === 'idle' || articlesStatus === 'loading';

  const visitorAccessPending =
    !isOwner && (articlesPending || visitorProfileHasPublicBody === null);

  const isLoading =
    !ownerResolved || albumsPending || visitorAccessPending || (isOwner && !ownerContentLoaded);

  const hasVisitorVisibleContent = hasVisitorVisibleArtistContent({
    albums: publicAlbums,
    articlesCount: publicArticles.length,
    profileHasPublicBody: visitorProfileHasPublicBody === true,
  });

  const showOnboardingSkeleton =
    !catalogArtistMissing &&
    isOwner &&
    ownerStoreHasNoReleases &&
    (isLoading || !ownerContentLoaded);

  const showOnboarding =
    !catalogArtistMissing && isOwner && ownerStillNeedsOnboarding && !showOnboardingSkeleton;

  const showNotFound =
    !isLoading && (catalogArtistMissing || (!isOwner && !hasVisitorVisibleContent));
  const showPublished =
    !isLoading &&
    !catalogArtistMissing &&
    !showOnboarding &&
    !showOnboardingSkeleton &&
    !showNotFound;
  const suppressPublishedArtistChrome = showOnboarding || showOnboardingSkeleton || showNotFound;

  return {
    isLoading,
    isOwner,
    hasPublicReleases,
    showOnboarding,
    showOnboardingSkeleton,
    showNotFound,
    showPublished,
    suppressPublishedArtistChrome,
  };
}
