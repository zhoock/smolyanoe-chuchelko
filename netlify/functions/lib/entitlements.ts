/**
 * Права на контент артиста: покупка альбома vs premium-подписка.
 * Подписка — источник доступа к subscribers_only (треки/статьи), sync lyrics, и т.д.;
 * покупка альбома — только владение этим релизом и скачивание его треков (без premium).
 */

import { query } from './db';

export async function getViewerEmailLower(userId: string): Promise<string | null> {
  const r = await query<{ email: string }>(`SELECT email FROM users WHERE id = $1::uuid LIMIT 1`, [
    userId,
  ]);
  const e = r.rows[0]?.email?.trim().toLowerCase();
  return e || null;
}

export async function viewerPurchasedAlbum(
  albumSlug: string,
  emailLower: string | null
): Promise<boolean> {
  if (!emailLower || !albumSlug) return false;
  const r = await query<{ one: number }>(
    `SELECT 1 AS one FROM purchases WHERE album_id = $1 AND LOWER(TRIM(customer_email)) = $2 LIMIT 1`,
    [albumSlug, emailLower]
  );
  return r.rows.length > 0;
}

export async function getArtistUserIdForAlbumSlug(albumSlug: string): Promise<string | null> {
  const r = await query<{ user_id: string }>(
    `SELECT user_id::text AS user_id FROM albums WHERE album_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
    [albumSlug]
  );
  return r.rows[0]?.user_id ?? null;
}

/**
 * Активная premium-подписка на артиста (заглушка до таблицы subscriptions).
 *
 * MOCK_ACTIVE_SUBSCRIPTION_USER_IDS — список UUID через запятую; эти пользователи считаются
 * подписанными на любого артиста (удобно для dev).
 *
 * MOCK_SUBSCRIPTION_USER_ARTIST_PAIRS — пары `subscriberUserId:artistUserId` через запятую.
 */
export async function viewerHasActiveSubscriptionToArtist(
  viewerUserId: string | null,
  artistOwnerUserId: string
): Promise<boolean> {
  if (!viewerUserId) return false;
  if (viewerUserId === artistOwnerUserId) return true;
  return Promise.resolve(mockActiveSubscriptionForArtist(viewerUserId, artistOwnerUserId));
}

function mockActiveSubscriptionForArtist(viewerUserId: string, artistOwnerUserId: string): boolean {
  const envAll = process.env.MOCK_ACTIVE_SUBSCRIPTION_USER_IDS?.trim();
  if (envAll) {
    const set = new Set(
      envAll
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    if (set.has(viewerUserId)) return true;
  }
  const pairsRaw = process.env.MOCK_SUBSCRIPTION_USER_ARTIST_PAIRS?.trim();
  if (pairsRaw) {
    const needle = `${viewerUserId}:${artistOwnerUserId}`;
    for (const p of pairsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (p === needle) return true;
    }
  }
  return false;
}
