-- Per-artist social network links (Instagram, Facebook, YouTube, VK)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.social_links IS 'Artist social profile URLs keyed by platform (instagram, facebook, youtube, vk)';
