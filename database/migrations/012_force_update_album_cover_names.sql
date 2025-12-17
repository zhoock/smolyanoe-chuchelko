-- Миграция: Принудительное обновление имен обложек альбомов (улучшенная версия)
-- Обновляет все старые имена обложек на новые, включая различные варианты

DO $$
DECLARE
  album_record RECORD;
  old_cover_img TEXT;
  new_cover_img TEXT;
  updated_count INTEGER := 0;
BEGIN
  -- Проходим по всем альбомам
  FOR album_record IN 
    SELECT id, cover, album_id
    FROM albums
    WHERE cover IS NOT NULL
  LOOP
    -- Извлекаем старое имя обложки из JSON
    old_cover_img := album_record.cover->>'img';
    
    -- Пропускаем, если имя обложки пустое
    IF old_cover_img IS NULL OR old_cover_img = '' THEN
      CONTINUE;
    END IF;
    
    -- Пропускаем, если уже в новом формате
    IF old_cover_img LIKE 'smolyanoe-chuchelko-Cover%' THEN
      CONTINUE;
    END IF;
    
    -- Определяем новое имя в зависимости от старого
    new_cover_img := NULL;
    
    -- Случай 1: Tar-Baby-Cover-* (любые варианты)
    IF old_cover_img LIKE '%Tar-Baby-Cover%' THEN
      new_cover_img := REPLACE(old_cover_img, 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover');
    -- Случай 2: 23-cover или просто albumId-cover
    ELSIF old_cover_img ~ '^[0-9]+-cover$' OR old_cover_img = album_record.album_id || '-cover' THEN
      new_cover_img := 'smolyanoe-chuchelko-Cover-' || album_record.album_id;
    -- Случай 3: Любое имя, содержащее только albumId и "cover"
    ELSIF old_cover_img LIKE album_record.album_id || '-cover%' AND old_cover_img NOT LIKE 'smolyanoe-chuchelko%' THEN
      new_cover_img := 'smolyanoe-chuchelko-Cover-' || album_record.album_id;
    END IF;
    
    -- Обновляем альбом, если нашли новое имя
    IF new_cover_img IS NOT NULL THEN
      UPDATE albums
      SET cover = jsonb_set(
        cover,
        '{img}',
        to_jsonb(new_cover_img)
      ),
      updated_at = NOW()
      WHERE id = album_record.id;
      
      updated_count := updated_count + 1;
      
      RAISE NOTICE 'Обновлен альбом %: % -> %', album_record.album_id, old_cover_img, new_cover_img;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Всего обновлено альбомов: %', updated_count;
END $$;

