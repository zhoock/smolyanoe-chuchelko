-- Migration: Normalize orders/purchases.album_id to albums.album_id slug (not albums.id UUID)
-- Date: 2026

UPDATE orders o
SET album_id = a.album_id
FROM albums a
WHERE o.album_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND a.id::text = o.album_id;

UPDATE purchases p
SET album_id = a.album_id
FROM albums a
WHERE p.album_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND a.id::text = p.album_id;
