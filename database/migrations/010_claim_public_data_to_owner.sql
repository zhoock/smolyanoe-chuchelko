-- Миграция: Привязка всех публичных данных к владельцу сайта
-- Владелец: zhoock@zhoock.ru
-- Все публичные данные (user_id IS NULL) привязываются к этому пользователю
-- Новые пользователи получат пустой сайт

DO $$
DECLARE
  owner_user_id UUID;
  albums_updated INTEGER;
  tracks_updated INTEGER;
  synced_lyrics_updated INTEGER;
  articles_updated INTEGER;
BEGIN
  -- Находим ID пользователя-владельца по email
  SELECT id INTO owner_user_id
  FROM users
  WHERE email = 'zhoock@zhoock.ru'
  LIMIT 1;

  -- Если пользователь не найден, создаём его
  IF owner_user_id IS NULL THEN
    INSERT INTO users (email, name, is_active)
    VALUES ('zhoock@zhoock.ru', 'Site Owner', true)
    RETURNING id INTO owner_user_id;
    
    RAISE NOTICE 'Created owner user: %', owner_user_id;
  ELSE
    RAISE NOTICE 'Found owner user: %', owner_user_id;
  END IF;

  -- Привязываем все публичные альбомы к владельцу
  UPDATE albums
  SET user_id = owner_user_id,
      is_public = false,
      updated_at = NOW()
  WHERE user_id IS NULL;

  GET DIAGNOSTICS albums_updated = ROW_COUNT;
  RAISE NOTICE 'Updated albums: %', albums_updated;

  -- Обновляем треки для привязанных альбомов
  UPDATE tracks
  SET updated_at = NOW()
  WHERE album_id IN (
    SELECT id FROM albums WHERE user_id = owner_user_id
  );

  GET DIAGNOSTICS tracks_updated = ROW_COUNT;
  RAISE NOTICE 'Updated tracks: %', tracks_updated;

  -- Привязываем все публичные синхронизации к владельцу
  UPDATE synced_lyrics
  SET user_id = owner_user_id,
      updated_at = NOW()
  WHERE user_id IS NULL;

  GET DIAGNOSTICS synced_lyrics_updated = ROW_COUNT;
  RAISE NOTICE 'Updated synced_lyrics: %', synced_lyrics_updated;

  -- Привязываем все публичные статьи к владельцу
  UPDATE articles
  SET user_id = owner_user_id,
      is_public = false,
      updated_at = NOW()
  WHERE user_id IS NULL;

  GET DIAGNOSTICS articles_updated = ROW_COUNT;
  RAISE NOTICE 'Updated articles: %', articles_updated;

  RAISE NOTICE 'Migration completed. Owner: %, Albums: %, Tracks: %, Synced lyrics: %, Articles: %',
    owner_user_id, albums_updated, tracks_updated, synced_lyrics_updated, articles_updated;

END $$;

COMMENT ON TABLE albums IS 'Альбомы пользователей (привязаны к владельцу сайта)';
COMMENT ON TABLE articles IS 'Статьи пользователей (привязаны к владельцу сайта)';

