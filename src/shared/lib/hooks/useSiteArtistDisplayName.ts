import { useEffect, useMemo, useRef, useState } from 'react';
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

  const [displayName, setDisplayName] = useState(() => {
    const v = options?.variant ?? 'public';
    const slug = options?.artistSlug?.trim() ?? '';
    if (v === 'public' && slug.length > 0) return '';
    return readStoredProfileDisplayName();
  });
  const [isLoading, setIsLoading] = useState(false);

  /** Публичный профиль: смена «цели» (?artist= / главная) — не показывать имя предыдущего артиста до ответа API. */
  const publicFetchKey = variant === 'public' ? `${hasArtistParam ? '1' : '0'}:${artistSlug}` : '';
  const publicFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (variant === 'public') {
      const prev = publicFetchKeyRef.current;
      publicFetchKeyRef.current = publicFetchKey;
      const isFirstPublicMount = prev === null;
      const targetChanged = !isFirstPublicMount && prev !== publicFetchKey;
      if (targetChanged || (isFirstPublicMount && hasArtistParam)) {
        setDisplayName('');
      }
    } else {
      publicFetchKeyRef.current = null;
    }

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
      setDisplayName(name);
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
