import type { NavigateFunction } from 'react-router-dom';

import type { IAlbums } from '@models';
import { hasPublishedPublicReleases } from '@entities/album/lib/hasPublishedPublicReleases';
import { fetchWithAuthSession } from '@shared/lib/authFetch';
import { getAuthHeader } from '@shared/lib/auth';
import { buildApiUrl } from '@shared/lib/artistQuery';

export type OwnArtistPageState = {
  publicSlug: string | null;
  hasPublicReleases: boolean;
  needsOnboarding: boolean;
};

export function buildOwnArtistPagePath(publicSlug: string): string {
  return `/?artist=${encodeURIComponent(publicSlug.trim())}`;
}

function normalizeAlbums(data: unknown): IAlbums[] {
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is IAlbums => typeof item === 'object' && item !== null);
}

export async function fetchOwnArtistPageState(lang: string): Promise<OwnArtistPageState> {
  const empty: OwnArtistPageState = {
    publicSlug: null,
    hasPublicReleases: false,
    needsOnboarding: false,
  };

  try {
    const profileResponse = await fetchWithAuthSession(
      buildApiUrl('/api/user-profile', { lang }, { includeArtist: false }),
      {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          ...getAuthHeader(),
        },
      }
    );

    if (!profileResponse.ok) return empty;

    const profileResult = (await profileResponse.json()) as {
      success?: boolean;
      data?: { publicSlug?: string | null };
    };
    const publicSlug = profileResult.success
      ? profileResult.data?.publicSlug?.trim() || null
      : null;
    if (!publicSlug) return empty;

    const albumsResponse = await fetchWithAuthSession(
      buildApiUrl('/api/albums', { lang }, { includeArtist: false }),
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          ...getAuthHeader(),
        },
      }
    );

    if (!albumsResponse.ok) {
      return { publicSlug, hasPublicReleases: false, needsOnboarding: true };
    }

    const albumsResult = (await albumsResponse.json()) as {
      success?: boolean;
      data?: unknown;
    };
    const albums = albumsResult.success ? normalizeAlbums(albumsResult.data) : [];
    const hasPublicReleases = hasPublishedPublicReleases(albums);

    return {
      publicSlug,
      hasPublicReleases,
      needsOnboarding: !hasPublicReleases,
    };
  } catch {
    return empty;
  }
}

export function openOwnArtistPage(
  publicSlug: string,
  hasPublicReleases: boolean,
  navigate: NavigateFunction
): void {
  const path = buildOwnArtistPagePath(publicSlug);
  if (!hasPublicReleases) {
    navigate(path);
    return;
  }
  window.open(path, '_blank', 'noopener,noreferrer');
}
