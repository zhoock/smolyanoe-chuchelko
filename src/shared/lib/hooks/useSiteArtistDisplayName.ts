import { useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { getToken } from '@shared/lib/auth';
import {
  fetchPublicProfileForDisplay,
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

  const [displayName, setDisplayName] = useState(() => readStoredProfileDisplayName());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        if (variant === 'authenticated') {
          const token = getToken();
          if (!token) {
            if (!cancelled) setDisplayName('');
            return;
          }
          const response = await fetch(
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
        } else {
          const { displayName: name } = await fetchPublicProfileForDisplay(
            lang,
            hasArtistParam ? artistSlug : null
          );
          if (!cancelled) {
            setDisplayName(name.trim() || readStoredProfileDisplayName());
          }
        }
      } catch {
        if (!cancelled) {
          setDisplayName(readStoredProfileDisplayName());
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, variant, hasArtistParam, artistSlug]);

  useEffect(() => {
    const handleProfileNameUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<ProfileNameUpdatedDetail>;
      const name = customEvent.detail?.name?.trim();
      if (!name) return;
      const slug = customEvent.detail?.publicSlug?.trim();
      if (variant === 'public' && hasArtistParam) {
        if (slug && slug !== artistSlug) return;
      }
      setDisplayName(name);
    };

    window.addEventListener('profile-name-updated', handleProfileNameUpdate);
    return () => window.removeEventListener('profile-name-updated', handleProfileNameUpdate);
  }, [variant, hasArtistParam, artistSlug]);

  const displayLabel = useMemo(() => siteArtistUiLabel(displayName), [displayName]);

  return { displayName, displayLabel, isLoading };
}
