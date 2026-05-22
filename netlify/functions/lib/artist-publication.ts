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
  has_public_album: boolean;
};

/**
 * Профиль артиста становится публичным только после первого public album/release.
 * Статьи, биография, hero image и album.buttons не влияют на видимость профиля.
 */
export async function getArtistPublicationSignals(
  userId: string
): Promise<ArtistPublicationSignals> {
  const userResult = await query<PublicationRow>(
    `SELECT EXISTS (
       SELECT 1
       FROM albums a
       WHERE a.user_id = u.id
         AND a.is_public = true
         AND btrim(COALESCE(a.album, '')) <> ''
     ) AS has_public_album
     FROM users u
     WHERE u.id = $1 AND u.is_active = true
     LIMIT 1`,
    [userId],
    0
  );

  if (userResult.rows.length === 0) {
    return { hasPublicAlbum: false };
  }

  return buildPublicationSignalsFromRow(userResult.rows[0]);
}

export async function assertArtistVisibleToViewer(
  targetUserId: string,
  viewerUserId: string | null | undefined
): Promise<void> {
  if (viewerUserId && viewerUserId === targetUserId) return;

  const published = await isArtistProfilePublished(targetUserId);
  if (!published) {
    throw new PublicArtistResolverError(404, 'Artist not found', 'ARTIST_NOT_PUBLISHED');
  }
}

export async function isArtistProfilePublished(userId: string): Promise<boolean> {
  const signals = await getArtistPublicationSignals(userId);
  return isArtistPublishedFromSignals(signals);
}
