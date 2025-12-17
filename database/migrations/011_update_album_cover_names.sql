-- Миграция: Обновление имен обложек альбомов
-- Заменяет старые имена обложек (Tar-Baby-Cover-*) на новые (smolyanoe-chuchelko-Cover-*)
-- Это нужно для совместимости с новой системой именования файлов

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
      AND cover::text LIKE '%"img"%'
  LOOP
    -- Извлекаем старое имя обложки из JSON
    old_cover_img := album_record.cover->>'img';
    
    -- Пропускаем, если имя обложки пустое или уже в новом формате
    IF old_cover_img IS NULL OR old_cover_img = '' THEN
      CONTINUE;
    END IF;
    
    -- Проверяем, нужно ли обновление (старые имена начинаются с "Tar-Baby-Cover")
    IF old_cover_img LIKE 'Tar-Baby-Cover%' THEN
      -- Заменяем "Tar-Baby-Cover" на "smolyanoe-chuchelko-Cover"
      new_cover_img := REPLACE(old_cover_img, 'Tar-Baby-Cover', 'smolyanoe-chuchelko-Cover');
      
      -- Обновляем альбом с новым именем обложки
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

