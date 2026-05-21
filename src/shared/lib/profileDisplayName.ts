import { getStore } from '@shared/model/appStore';
import { selectPublicArtistSlug } from '@shared/model/currentArtist';

import { fetchWithAuthSession } from '@shared/lib/authFetch';

import { buildApiUrl } from './artistQuery';

export const PROFILE_NAME_STORAGE_KEY = 'profile-name';

export function readStoredProfileDisplayName(): string {
  try {
    return localStorage.getItem(PROFILE_NAME_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

/** Подпись в UI: актуальное имя, затем кэш профиля, затем placeholder (например «—»). */
export function siteArtistUiLabel(displayName: string, emptyFallback = '—'): string {
  const a = displayName.trim();
  if (a) return a;
  const b = readStoredProfileDisplayName().trim();
  if (b) return b;
  return emptyFallback;
}

/** Подписи и alt для обложек: единое имя из профиля + название альбома (не albums.artist). */
export function formatAlbumDisplayFullName(siteDisplayName: string, albumTitle: string): string {
  const s = siteDisplayName.trim();
  const t = (albumTitle ?? '').trim();
  if (s && t) return `${s} — ${t}`;
  return t || s || '';
}

export type PublicProfileForDisplay = {
  displayName: string;
  publicSlug: string | null;
};

const profileCache = new Map<string, PublicProfileForDisplay>();
const profileInflight = new Map<string, Promise<PublicProfileForDisplay>>();

function resolveArtistSlug(artistSlugOverride?: string | null): string {
  return (artistSlugOverride?.trim() || selectPublicArtistSlug(getStore().getState()) || '').trim();
}

function profileCacheKey(lang: string, slug: string): string {
  return `${lang}:${slug.toLowerCase()}`;
}

export function getCachedPublicProfileForDisplay(
  lang: string,
  artistSlugOverride?: string | null
): PublicProfileForDisplay | null {
  const slug = resolveArtistSlug(artistSlugOverride);
  if (!slug) return null;
  return profileCache.get(profileCacheKey(lang, slug)) ?? null;
}

export function invalidatePublicProfileDisplayCache(slug?: string): void {
  if (!slug?.trim()) {
    profileCache.clear();
    profileInflight.clear();
    return;
  }
  const normalized = slug.trim().toLowerCase();
  for (const key of [...profileCache.keys()]) {
    if (key.endsWith(`:${normalized}`)) {
      profileCache.delete(key);
      profileInflight.delete(key);
    }
  }
}

/** Стартует загрузку профиля заранее (route loader, prefetch). */
export function prefetchPublicProfileForDisplay(
  lang: string,
  artistSlugOverride?: string | null
): void {
  const slug = resolveArtistSlug(artistSlugOverride);
  if (!slug) return;
  void fetchPublicProfileForDisplay(lang, slug);
}

async function fetchPublicProfileForDisplayNetwork(
  lang: string,
  slug: string
): Promise<PublicProfileForDisplay> {
  const fallbackName = '';

  try {
    const url = buildApiUrl(
      '/api/user-profile',
      { lang },
      { includeArtist: true, artistSlugOverride: slug }
    );
    const response = await fetchWithAuthSession(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      return { displayName: fallbackName, publicSlug: null };
    }
    const result = (await response.json()) as {
      success?: boolean;
      data?: {
        siteName?: string | null;
        name?: string | null;
        publicSlug?: string | null;
      };
    };
    if (!result.success || !result.data) {
      return { displayName: fallbackName, publicSlug: null };
    }
    const displayName = (result.data.siteName ?? result.data.name ?? '').trim() || fallbackName;
    const publicSlug = result.data.publicSlug?.trim() || null;
    return { displayName, publicSlug };
  } catch {
    return { displayName: fallbackName, publicSlug: null };
  }
}

/**
 * Публичный профиль: имя для UI (site_name) и public_slug владельца страницы / ?artist=.
 * Кэширует ответ и дедуплицирует параллельные запросы.
 */
export async function fetchPublicProfileForDisplay(
  lang: string,
  artistSlugOverride?: string | null
): Promise<PublicProfileForDisplay> {
  const slug = resolveArtistSlug(artistSlugOverride);
  if (!slug) {
    return { displayName: readStoredProfileDisplayName(), publicSlug: null };
  }

  const key = profileCacheKey(lang, slug);
  const cached = profileCache.get(key);
  if (cached) return cached;

  const pending = profileInflight.get(key);
  if (pending) return pending;

  const promise = fetchPublicProfileForDisplayNetwork(lang, slug)
    .then((result) => {
      profileCache.set(key, result);
      profileInflight.delete(key);
      return result;
    })
    .catch((error) => {
      profileInflight.delete(key);
      throw error;
    });

  profileInflight.set(key, promise);
  return promise;
}

/**
 * Только отображаемое имя (для мини-плеера / мета без slug).
 */
export async function fetchPublicProfileDisplayName(
  lang: string,
  artistSlugOverride?: string | null
): Promise<string> {
  const r = await fetchPublicProfileForDisplay(lang, artistSlugOverride);
  return r.displayName;
}

export type ProfileNameUpdatedDetail = { name: string; publicSlug?: string };
