import type { IAlbums, IArticles } from '@models';

import { hasPublishedPublicReleases } from '@entities/album/lib/hasPublishedPublicReleases';

type ProfileContentInput = {
  siteName?: string | null;
  theBand?: string[];
  headerImages?: string[];
  socialLinks?: Record<string, string | undefined>;
};

export function countUniqueAlbums(albums: IAlbums[]): number {
  const ids = new Set(albums.map((album) => album.albumId).filter(Boolean));
  return ids.size > 0 ? ids.size : albums.length;
}

export function countUniqueArticles(articles: IArticles[]): number {
  const ids = new Set(articles.map((article) => article.articleId).filter(Boolean));
  return ids.size > 0 ? ids.size : articles.length;
}

/** Профиль «пуст» для онбординга: bio, hero, соцсети. site_name из регистрации не считается контентом. */
export function isArtistProfileEmpty(profile: ProfileContentInput): boolean {
  if (profile.headerImages?.some((image) => image.trim())) return false;
  if (profile.theBand?.some((line) => line.trim())) return false;
  if (Object.values(profile.socialLinks ?? {}).some((value) => value?.trim())) return false;
  return true;
}

/** Публичное тело профиля для посетителя: bio, hero, соцсети. Одного site_name недостаточно. */
export function profileHasPublicBodyContent(profile: ProfileContentInput): boolean {
  if (profile.headerImages?.some((image) => image.trim())) return true;
  if (profile.theBand?.some((line) => line.trim())) return true;
  if (Object.values(profile.socialLinks ?? {}).some((value) => value?.trim())) return true;
  return false;
}

export function filterAlbumsForArtistPageSurface(albums: IAlbums[], isOwner: boolean): IAlbums[] {
  if (isOwner) return albums;
  return albums.filter(
    (album) =>
      album.isPublic !== false &&
      typeof album.album === 'string' &&
      album.album.trim().length > 0 &&
      (album.tracks?.length ?? 0) > 0
  );
}

export function hasVisitorVisibleArtistContent(options: {
  albums: IAlbums[];
  articlesCount: number;
  profileHasPublicBody: boolean;
}): boolean {
  if (hasPublishedPublicReleases(options.albums)) return true;
  if (options.articlesCount > 0) return true;
  if (options.profileHasPublicBody) return true;
  return false;
}

export function needsArtistOnboarding(options: {
  albumsCount: number;
  articlesCount: number;
  profileIsEmpty: boolean;
}): boolean {
  return options.albumsCount === 0 && options.articlesCount === 0 && options.profileIsEmpty;
}
