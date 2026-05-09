-- Уровень доступа к треку в публичном каталоге и в плеере.
-- public — все; subscribers_only — только купившие альбом (таблица purchases); hidden — не показывать в каталоге.

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(24) NOT NULL DEFAULT 'public';

ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_visibility_check;

ALTER TABLE tracks
  ADD CONSTRAINT tracks_visibility_check
  CHECK (visibility IN ('public', 'subscribers_only', 'hidden'));

CREATE INDEX IF NOT EXISTS idx_tracks_visibility ON tracks (visibility);

COMMENT ON COLUMN tracks.visibility IS 'Доступ к треку на публичной странице: public | subscribers_only | hidden';
