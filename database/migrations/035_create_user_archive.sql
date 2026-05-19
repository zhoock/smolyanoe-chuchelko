-- Archive: список артистов, открытых пользователем.
-- Отдельно от subscriptions; при истечении подписки записи не удаляются.

CREATE TABLE IF NOT EXISTS user_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_archive_user_artist_unique UNIQUE (user_id, artist_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_archive_user_id ON user_archive (user_id);
CREATE INDEX IF NOT EXISTS idx_user_archive_artist_user_id ON user_archive (artist_user_id);

CREATE TRIGGER update_user_archive_updated_at
  BEFORE UPDATE ON user_archive
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_archive IS 'Артисты в archive пользователя (premium-доступ после активной подписки)';
COMMENT ON COLUMN user_archive.user_id IS 'Подписчик / владелец archive';
COMMENT ON COLUMN user_archive.artist_user_id IS 'Артист, добавленный в archive';
