import { useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { getToken } from '@shared/lib/auth';
import { fetchWithAuthSession } from '@shared/lib/authFetch';
import {
  getPublicArtistDisplayName,
  ensurePublicArtistsLoaded,
} from '@shared/lib/publicArtistsCache';
import {
  fetchPublicProfileForDisplay,
  getCachedPublicProfileForDisplay,
  invalidatePublicProfileDisplayCache,
  readStoredProfileDisplayName,
  siteArtistUiLabel,
  type ProfileNameUpdatedDetail,
} from '@shared/lib/profileDisplayName';

export type UseSiteArtistDisplayNameVariant = 'public' | 'authenticated';

export type UseSiteArtistDisplayNameResult = {
  /** Сырое имя из профиля (site_name), может быть пустым пока грузится. */
  displayName: string;
  /** Подпись для UI: имя, иначе кэш/placeholder из `siteArtistUiLabel`. */
  displayLabel: string;
  isLoading: boolean;
};

function resolvePublicDisplayNameSeed(lang: string, artistSlug: string): string {
  const cached = getCachedPublicProfileForDisplay(lang, artistSlug);
  if (cached?.displayName.trim()) return cached.displayName.trim();
  return getPublicArtistDisplayName(artistSlug);
}

/**
 * Единое отображаемое имя артиста (site_name профиля), без albums.artist.
 */
export function useSiteArtistDisplayName(
  lang: string,
  options?: {
    variant?: UseSiteArtistDisplayNameVariant;
    /** Для public: slug из ?artist= */
    artistSlug?: string | null;
  }
): UseSiteArtistDisplayNameResult {
  const variant = options?.variant ?? 'public';
  const artistSlug = options?.artistSlug?.trim() ?? '';
  const hasArtistParam = variant === 'public' && artistSlug.length > 0;

  const [displayName, setDisplayName] = useState(() => {
    const v = options?.variant ?? 'public';
    const slug = options?.artistSlug?.trim() ?? '';
    if (v === 'public' && slug.length > 0) {
      return resolvePublicDisplayNameSeed(lang, slug);
    }
    return readStoredProfileDisplayName();
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (variant === 'public' && hasArtistParam) {
      return !resolvePublicDisplayNameSeed(lang, artistSlug);
    }
    return false;
  });

  const publicFetchKey = variant === 'public' ? `${hasArtistParam ? '1' : '0'}:${artistSlug}` : '';
  const publicFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (variant === 'public') {
      const prev = publicFetchKeyRef.current;
      publicFetchKeyRef.current = publicFetchKey;
      const targetChanged = prev !== null && prev !== publicFetchKey;
      if (targetChanged) {
        setDisplayName(hasArtistParam ? resolvePublicDisplayNameSeed(lang, artistSlug) : '');
      }
    } else {
      publicFetchKeyRef.current = null;
    }

    (async () => {
      const hasSeedName =
        variant === 'public' && hasArtistParam && !!resolvePublicDisplayNameSeed(lang, artistSlug);
      if (!hasSeedName) {
        setIsLoading(true);
      }

      const profilePromise =
        variant === 'public'
          ? fetchPublicProfileForDisplay(lang, hasArtistParam ? artistSlug : null)
          : null;

      if (variant === 'public' && hasArtistParam && !hasSeedName) {
        await ensurePublicArtistsLoaded();
        if (cancelled) return;
        const interimName = getPublicArtistDisplayName(artistSlug);
        if (interimName) {
          setDisplayName(interimName);
        }
      }

      try {
        if (variant === 'authenticated') {
          const token = getToken();
          if (!token) {
            if (!cancelled) setDisplayName('');
            return;
          }
          const response = await fetchWithAuthSession(
            buildApiUrl('/api/user-profile', {}, { includeArtist: false }),
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (cancelled) return;
          if (response.ok) {
            const result = (await response.json()) as {
              success?: boolean;
              data?: { siteName?: string | null; name?: string | null };
            };
            const name = result.success
              ? (result.data?.siteName ?? result.data?.name ?? '').trim()
              : '';
            setDisplayName(name || readStoredProfileDisplayName());
          } else {
            setDisplayName(readStoredProfileDisplayName());
          }
        } else if (profilePromise) {
          const { displayName: name } = await profilePromise;
          if (!cancelled) {
            const trimmed = name.trim();
            setDisplayName(trimmed || (hasArtistParam ? '' : readStoredProfileDisplayName()));
          }
        }
      } catch {
        if (!cancelled) {
          if (hasArtistParam) {
            const seed = resolvePublicDisplayNameSeed(lang, artistSlug);
            setDisplayName(seed);
          } else {
            setDisplayName(readStoredProfileDisplayName());
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, variant, hasArtistParam, artistSlug, publicFetchKey]);

  useEffect(() => {
    const handleProfileNameUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileNameUpdatedDetail>;
      const name = customEvent.detail?.name?.trim();
      if (!name) return;
      const slug = customEvent.detail?.publicSlug?.trim();
      if (variant === 'public' && hasArtistParam) {
        if (slug && slug !== artistSlug) return;
      }
      if (slug) {
        invalidatePublicProfileDisplayCache(slug);
      }
      setDisplayName(name);
      setIsLoading(false);
    };

    window.addEventListener('profile-name-updated', handleProfileNameUpdate);
    return () => window.removeEventListener('profile-name-updated', handleProfileNameUpdate);
  }, [variant, hasArtistParam, artistSlug]);

  const displayLabel = useMemo(() => {
    if (variant === 'public' && isLoading && !displayName.trim()) {
      return '';
    }
    return siteArtistUiLabel(displayName);
  }, [displayName, isLoading, variant]);

  return { displayName, displayLabel, isLoading };
}
