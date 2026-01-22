-- Миграция: Преобразование the_band в двуязычный формат (RU/EN)
-- Дата: 2025
--
-- Преобразует существующие данные из массива строк в объект с ключами ru и en
-- Если данные уже в старом формате (массив), они будут преобразованы в {ru: [...], en: [...]}
-- Если данные уже в новом формате, миграция безопасна

-- Функция для преобразования данных
DO $$
DECLARE
    user_record RECORD;
    current_band JSONB;
    new_band JSONB;
BEGIN
    -- Проходим по всем пользователям с the_band
    FOR user_record IN 
        SELECT id, the_band 
        FROM users 
        WHERE the_band IS NOT NULL
    LOOP
        current_band := user_record.the_band;
        
        -- Проверяем, является ли текущее значение массивом (старый формат)
        IF jsonb_typeof(current_band) = 'array' THEN
            -- Преобразуем массив в объект с ru и en ключами
            -- Используем одни и те же данные для обоих языков как fallback
            new_band := jsonb_build_object(
                'ru', current_band,
                'en', current_band
            );
            
            -- Обновляем запись
            UPDATE users
            SET the_band = new_band
            WHERE id = user_record.id;
            
            RAISE NOTICE 'Преобразованы данные для пользователя %: массив -> объект с ru/en', user_record.id;
        ELSIF jsonb_typeof(current_band) = 'object' THEN
            -- Если уже объект, проверяем наличие ru и en ключей
            IF NOT (current_band ? 'ru' AND current_band ? 'en') THEN
                -- Если нет обоих ключей, создаем их
                new_band := jsonb_build_object(
                    'ru', COALESCE(current_band->'ru', '[]'::jsonb),
                    'en', COALESCE(current_band->'en', '[]'::jsonb)
                );
                
                UPDATE users
                SET the_band = new_band
                WHERE id = user_record.id;
                
                RAISE NOTICE 'Обновлены ключи для пользователя %: добавлены ru/en', user_record.id;
            END IF;
        END IF;
    END LOOP;
END $$;

-- Обновляем комментарий для поля
COMMENT ON COLUMN users.the_band IS 'Описание группы в двуязычном формате: {ru: [...], en: [...]} - массивы строк для русского и английского языков';
