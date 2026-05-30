import { query } from './db';
import { PublicArtistResolverError } from './public-artist-resolver';
import {
  buildPublicationSignalsFromRow,
  isArtistPublishedFromSignals,
  type ArtistPublicationSignals,
} from './artist-publication-signals';

export type { ArtistPublicationSignals };
export { isArtistPublishedFromSignals } from './artist-publication-signals';

type PublicationRow = {
  has_published_tracks: boolean;
};

type ProfileContentRow = {
  has_profile_content: boolean;
};

type PublicArticlesRow = {
  has_public_articles: boolean;
};

/**
 * Catalog/search visibility: at least one public non-hidden track on a public release.
 */
export async function getArtistPublicationSignals(
  userId: string
): Promise<ArtistPublicationSignals> {
  const userResult = await query<PublicationRow>(
    `SELECT EXISTS (
       SELECT 1
       FROM tracks t
       INNER JOIN albums a ON t.album_id = a.id
       WHERE a.user_id = u.id
         AND a.is_public = true
         AND btrim(COALESCE(a.album, '')) <> ''
         AND COALESCE(t.visibility, 'public') <> 'hidden'
     ) AS has_published_tracks
     FROM users u
     WHERE u.id = $1 AND u.is_active = true
     LIMIT 1`,
    [userId],
    0
  );

  if (userResult.rows.length === 0) {
    return { hasPublishedTracks: false };
  }

  return buildPublicationSignalsFromRow(userResult.rows[0]);
}

async function hasPublishedTracks(userId: string): Promise<boolean> {
  const signals = await getArtistPublicationSignals(userId);
  return isArtistPublishedFromSignals(signals);
}

async function hasPublicArticles(userId: string): Promise<boolean> {
  const result = await query<PublicArticlesRow>(
    `SELECT EXISTS (
       SELECT 1
       FROM articles ar
       WHERE ar.user_id = $1
         AND (ar.is_draft = false OR ar.is_draft IS NULL)
         AND COALESCE(ar.visibility, 'public') <> 'hidden'
     ) AS has_public_articles`,
    [userId],
    0
  );
  return Boolean(result.rows[0]?.has_public_articles);
}

async function hasPublicProfileContent(userId: string): Promise<boolean> {
  const result = await query<ProfileContentRow>(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(u.header_images, '[]'::jsonb)) AS img
         WHERE btrim(img #>> '{}') <> '' OR btrim(img::text, '"') <> ''
       )
       OR (
         u.the_band IS NOT NULL
         AND btrim(u.the_band::text) NOT IN ('null', '[]', '{}', '{"ru":[],"en":[]}')
       )
       OR EXISTS (
         SELECT 1
         FROM jsonb_each_text(COALESCE(u.social_links, '{}'::jsonb)) AS sl
         WHERE btrim(sl.value) <> ''
       )
     ) AS has_profile_content
     FROM users u
     WHERE u.id = $1 AND u.is_active = true
     LIMIT 1`,
    [userId],
    0
  );
  return Boolean(result.rows[0]?.has_profile_content);
}

/** Visitor-facing page content beyond catalog eligibility. */
export async function artistHasPublicPageContent(userId: string): Promise<boolean> {
  const [tracks, articles, profile] = await Promise.all([
    hasPublishedTracks(userId),
    hasPublicArticles(userId),
    hasPublicProfileContent(userId),
  ]);
  return tracks || articles || profile;
}

export async function assertArtistVisibleToViewer(
  targetUserId: string,
  viewerUserId: string | null | undefined
): Promise<void> {
  if (viewerUserId && viewerUserId === targetUserId) return;

  const visible = await artistHasPublicPageContent(targetUserId);
  if (!visible) {
    throw new PublicArtistResolverError(404, 'Artist not found', 'ARTIST_NOT_PUBLISHED');
  }
}

/** Catalog / universe / search: published tracks only. */
export async function isArtistProfilePublished(userId: string): Promise<boolean> {
  return hasPublishedTracks(userId);
}
