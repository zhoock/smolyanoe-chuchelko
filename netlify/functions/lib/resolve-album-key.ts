/**
 * Resolve album by frontend key: albums.id (UUID) or albums.album_id (slug).
 */

import { query } from './db';

export function isAlbumUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export interface ResolvedAlbum {
  id: string;
  albumSlug: string;
  artist: string;
  album: string;
  lang: string;
  cover: string | null;
  userId: string | null;
}

type AlbumRow = {
  id: string;
  album_slug: string;
  artist: string;
  album: string;
  lang: string;
  cover: string | null;
  user_id: string | null;
};

function mapAlbumRow(row: AlbumRow): ResolvedAlbum {
  return {
    id: row.id,
    albumSlug: row.album_slug,
    artist: row.artist,
    album: row.album,
    lang: row.lang,
    cover: row.cover,
    userId: row.user_id,
  };
}

const ALBUM_SELECT = `
  SELECT id::text AS id,
         album_id AS album_slug,
         artist,
         album,
         lang,
         cover,
         user_id::text AS user_id
  FROM albums
`;

/** Prefer album row that actually has tracks (bilingual albums may have empty locale rows). */
const ALBUM_ROW_PRIORITY = `
  ORDER BY (
    SELECT COUNT(*)::int FROM tracks t WHERE t.album_id = albums.id
  ) DESC,
  updated_at DESC NULLS LAST
`;

/** Canonical albums.album_id slug for storage in orders/purchases. */
export async function resolveAlbumSlug(albumKey: string): Promise<string | null> {
  const album = await resolveAlbumByKey(albumKey);
  return album?.albumSlug ?? null;
}

export async function resolveAlbumByKey(albumKey: string): Promise<ResolvedAlbum | null> {
  const trimmed = albumKey.trim();
  if (!trimmed) {
    return null;
  }

  if (isAlbumUuid(trimmed)) {
    const byPk = await query<AlbumRow>(
      `${ALBUM_SELECT} WHERE id = $1::uuid ${ALBUM_ROW_PRIORITY} LIMIT 1`,
      [trimmed]
    );
    if (byPk.rows[0]) {
      return mapAlbumRow(byPk.rows[0]);
    }
  }

  const bySlug = await query<AlbumRow>(
    `${ALBUM_SELECT} WHERE album_id = $1 ${ALBUM_ROW_PRIORITY} LIMIT 1`,
    [trimmed]
  );
  if (bySlug.rows[0]) {
    return mapAlbumRow(bySlug.rows[0]);
  }

  return null;
}

export async function fetchTracksForResolvedAlbum(
  album: ResolvedAlbum
): Promise<Array<{ trackId: string; title: string }>> {
  const tracksResult = await query<{
    track_id: string;
    title: string;
  }>(
    `SELECT t.track_id, t.title
     FROM tracks t
     WHERE t.album_id = $1::uuid
     ORDER BY t.order_index ASC`,
    [album.id]
  );

  return tracksResult.rows.map((row) => ({
    trackId: row.track_id,
    title: row.title,
  }));
}
