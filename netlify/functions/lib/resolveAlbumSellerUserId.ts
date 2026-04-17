import { query } from './db';

function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Найти владельца альбома по ключу из фронта:
 * — UUID первичного ключа `albums.id`;
 * — или строковый `albums.album_id` (slug, например "23", "23-remastered").
 */
export async function resolveAlbumSellerUserId(albumKey: string): Promise<string | null> {
  const trimmed = albumKey.trim();
  if (!trimmed) {
    return null;
  }

  if (isValidUUID(trimmed)) {
    const byPk = await query<{ user_id: string | null }>(
      'SELECT user_id FROM albums WHERE id = $1::uuid LIMIT 1',
      [trimmed]
    );
    if (byPk.rows.length > 0 && byPk.rows[0].user_id) {
      return byPk.rows[0].user_id;
    }
  }

  const byAlbumId = await query<{ user_id: string | null }>(
    'SELECT user_id FROM albums WHERE album_id = $1 LIMIT 1',
    [trimmed]
  );
  if (byAlbumId.rows.length > 0 && byAlbumId.rows[0].user_id) {
    return byAlbumId.rows[0].user_id;
  }
  return null;
}
