-- Убираем лишние кавычки из cover
-- Если cover = '"smolyanoe-chuchelko-Cover-23-remastered"', превращаем в 'smolyanoe-chuchelko-Cover-23-remastered'

UPDATE albums
SET cover = TRIM(BOTH '"' FROM cover)
WHERE cover IS NOT NULL 
  AND (cover LIKE '"%"' OR cover LIKE '"%.webp"' OR cover LIKE '"%.jpg"');

