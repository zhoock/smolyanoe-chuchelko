// src/shared/lib/utils/authorshipCache.ts
/**
 * Утилиты для работы с кешем authorship в localStorage
 */

const AUTHORS_CACHE_KEY = 'authorship-cache-v1';

export function getCachedAuthorship(albumId: string, trackId: string, lang: string): string | null {
  try {
    const raw = localStorage.getItem(AUTHORS_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const key = `${albumId}:${trackId}:${lang}`;
    return map[key] ?? null;
  } catch {
    return null;
  }
}

export function setCachedAuthorship(
  albumId: string,
  trackId: string,
  lang: string,
  authorship?: string
): void {
  try {
    const raw = localStorage.getItem(AUTHORS_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const key = `${albumId}:${trackId}:${lang}`;
    if (authorship && authorship.trim()) {
      map[key] = authorship.trim();
    } else {
      delete map[key];
    }
    localStorage.setItem(AUTHORS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // игнорируем ошибки localStorage
  }
}
