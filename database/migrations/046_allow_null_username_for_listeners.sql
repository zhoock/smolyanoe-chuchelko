-- Listener accounts have no artist identity until upgrade to artist.
-- username / public_slug / site_name stay NULL for listeners.

ALTER TABLE users
ALTER COLUMN username DROP NOT NULL;

COMMENT ON COLUMN users.username IS 'Artist handle, NULL for listener accounts until upgrade';
