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

/**
 * Публичный профиль: имя для UI (site_name) и public_slug владельца страницы / ?artist=.
 */
export async function fetchPublicProfileForDisplay(
  lang: string,
  artistSlugOverride?: string | null
): Promise<PublicProfileForDisplay> {
  try {
    const url = buildApiUrl(
      '/api/user-profile',
      { lang },
      { includeArtist: true, artistSlugOverride }
    );
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) {
      return { displayName: readStoredProfileDisplayName(), publicSlug: null };
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
      return { displayName: readStoredProfileDisplayName(), publicSlug: null };
    }
    const displayName =
      (result.data.siteName ?? result.data.name ?? '').trim() || readStoredProfileDisplayName();
    const publicSlug = result.data.publicSlug?.trim() || null;
    return { displayName, publicSlug };
  } catch {
    return { displayName: readStoredProfileDisplayName(), publicSlug: null };
  }
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
