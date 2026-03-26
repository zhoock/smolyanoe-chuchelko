-- Миграция: Backfill public_slug и нормализация default-пользователя
-- Дата: 2026
--
-- Требования:
-- - Сгенерировать slug для существующих пользователей
-- - Разрешить коллизии через суффиксы -2, -3, ...
-- - Гарантировать ровно одного default-пользователя
-- - Если default отсутствует, выбрать стабильного кандидата

DO $$
DECLARE
  user_record RECORD;
  base_source TEXT;
  base_slug TEXT;
  candidate_slug TEXT;
  suffix INTEGER;
  chosen_default_id UUID;
BEGIN
  -- 1) Backfill slug для пользователей без public_slug
  FOR user_record IN
    SELECT id, email, name, site_name
    FROM users
    WHERE public_slug IS NULL OR btrim(public_slug) = ''
    ORDER BY created_at ASC, id ASC
  LOOP
    base_source := COALESCE(NULLIF(btrim(user_record.site_name), ''), NULLIF(btrim(user_record.name), ''));

    IF base_source IS NULL OR base_source = '' THEN
      base_source := split_part(user_record.email, '@', 1);
    END IF;

    -- slugify: lowercase -> не [a-z0-9] в "-" -> схлопывание "-" -> trim "-"
    base_slug := lower(base_source);
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-{2,}', '-', 'g');
    base_slug := btrim(base_slug, '-');

    IF base_slug IS NULL OR base_slug = '' THEN
      base_slug := 'artist';
    END IF;

    candidate_slug := base_slug;
    suffix := 2;

    WHILE EXISTS (
      SELECT 1
      FROM users u
      WHERE u.public_slug = candidate_slug
        AND u.id <> user_record.id
    ) LOOP
      candidate_slug := base_slug || '-' || suffix::TEXT;
      suffix := suffix + 1;
    END LOOP;

    UPDATE users
    SET public_slug = candidate_slug,
        updated_at = NOW()
    WHERE id = user_record.id;
  END LOOP;

  -- 2) Нормализуем default-флаг:
  -- Сбрасываем всех в false, затем явно выбираем одного.
  UPDATE users
  SET is_default_public_site = false
  WHERE is_default_public_site = true;

  -- Предпочтение: текущий production owner по email.
  SELECT id INTO chosen_default_id
  FROM users
  WHERE email = 'zhoock@zhoock.ru' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  -- Если не нашли owner, берем первого активного пользователя.
  IF chosen_default_id IS NULL THEN
    SELECT id INTO chosen_default_id
    FROM users
    WHERE is_active = true
    ORDER BY created_at ASC, id ASC
    LIMIT 1;
  END IF;

  -- Если нет вообще активных, это ошибка конфигурации.
  IF chosen_default_id IS NULL THEN
    RAISE EXCEPTION 'Configuration error: no active users found to set default public site';
  END IF;

  UPDATE users
  SET is_default_public_site = true,
      updated_at = NOW()
  WHERE id = chosen_default_id;
END $$;
