// src/widgets/hero/ui/Hero.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { loadHeaderImagesFromDatabase } from '@entities/user/lib';
import { getToken } from '@shared/lib/auth';
import './style.scss';

/**
 * Генерирует image-set() строку из базового URL изображения
 * @param baseUrl - базовый URL изображения (например, https://.../hero-123-1920.jpg)
 * @returns image-set() строка с вариантами для разных форматов (без размеров)
 */
function generateImageSetFromUrl(baseUrl: string): string {
  // Если URL уже содержит image-set, нормализуем его (убираем переносы строк)
  if (baseUrl.includes('image-set')) {
    // Убираем переносы строк и лишние пробелы для корректного использования в inline style
    return baseUrl.replace(/\n\s*/g, ' ').trim();
  }

  // Если это локальный путь (начинается с /images/), возвращаем простой URL
  if (baseUrl.startsWith('/images/')) {
    return `url('${baseUrl}')`;
  }

  // Извлекаем базовое имя файла из URL
  // Примеры:
  // - https://.../hero-123-1920.jpg -> hero-123
  // - https://.../hero-123-abc-1920.jpg -> hero-123-abc
  const urlMatch = baseUrl.match(/([^/]+)-(\d+)\.(jpg|webp|avif)$/);
  if (!urlMatch) {
    // Если не удалось распарсить, возвращаем простой URL
    return `url('${baseUrl}')`;
  }

  const baseName = urlMatch[1]; // hero-123
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1); // https://.../users/.../hero/

  // Для background-image используем только один размер (1920px для desktop) и несколько форматов
  // Браузер выберет оптимальный формат, но не будет загружать несколько размеров
  const size = 1920; // Используем Full HD размер для desktop
  const formats = ['avif', 'webp', 'jpg']; // Форматы в порядке приоритета

  // Генерируем варианты для image-set (только форматы, один размер)
  const variants: string[] = [];
  for (const format of formats) {
    const variantUrl = `${basePath}${baseName}-${size}.${format}`;
    const mimeType =
      format === 'avif' ? 'image/avif' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    variants.push(`url('${variantUrl}') type('${mimeType}')`);
  }

  // Убираем переносы строк для корректного использования в inline style
  return `image-set(${variants.join(', ')})`;
}

export function Hero() {
  const [backgroundImage, setBackgroundImage] = useState('');
  const [headerImages, setHeaderImages] = useState<string[]>([]);
  const [profileName, setProfileName] = useState<string>('');
  const location = useLocation();
  const lastPathRef = useRef<string>('');
  const imagesLoadedRef = useRef<boolean>(false);
  const imageSelectedForPathRef = useRef<string>('');

  // Загружаем изображения из БД
  useEffect(() => {
    const loadImages = async () => {
      try {
        const images = await loadHeaderImagesFromDatabase();
        console.log('📸 [Hero] Загружены header images из БД:', images);
        if (images && images.length > 0) {
          setHeaderImages(images);
        } else {
          console.warn('⚠️ [Hero] Header images не найдены в БД (пустой массив)');
        }
        imagesLoadedRef.current = true;
      } catch (error) {
        console.error('❌ [Hero] Ошибка загрузки header images из БД:', error);
        setHeaderImages([]);
        imagesLoadedRef.current = true;
      }
    };
    loadImages();
  }, []);

  // Загружаем название группы из API или localStorage
  useEffect(() => {
    const loadProfileName = async () => {
      // Сначала проверяем localStorage для быстрого отображения
      const storedName = localStorage.getItem('profile-name');
      if (storedName) {
        setProfileName(storedName);
      }

      try {
        const token = getToken();
        if (!token) {
          // Если не авторизован, используем значение из localStorage или значение по умолчанию
          if (!storedName) {
            setProfileName('Смоляное чучелко');
          }
          return;
        }

        const response = await fetch('/api/user-profile', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.siteName) {
            setProfileName(result.data.siteName);
            // Сохраняем в localStorage для использования без авторизации
            localStorage.setItem('profile-name', result.data.siteName);
          } else if (!storedName) {
            // Если в API нет siteName и нет в localStorage, используем значение по умолчанию
            setProfileName('Смоляное чучелко');
          }
        } else if (!storedName) {
          // Если запрос не удался и нет в localStorage, используем значение по умолчанию
          setProfileName('Смоляное чучелко');
        }
      } catch (error) {
        console.warn('⚠️ Ошибка загрузки названия группы из профиля:', error);
        // В случае ошибки используем localStorage или значение по умолчанию
        if (!storedName) {
          setProfileName('Смоляное чучелко');
        }
      }
    };

    loadProfileName();

    // Слушаем событие обновления названия группы
    const handleProfileNameUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ name: string }>;
      if (customEvent.detail?.name) {
        setProfileName(customEvent.detail.name);
      }
    };

    window.addEventListener('profile-name-updated', handleProfileNameUpdate);

    return () => {
      window.removeEventListener('profile-name-updated', handleProfileNameUpdate);
    };
  }, []);

  // Выбираем случайное изображение при загрузке данных или изменении пути
  useEffect(() => {
    // Выбираем изображение только если данные загружены
    if (!imagesLoadedRef.current) {
      return;
    }

    // Выбираем случайное изображение при изменении пути
    // При перезагрузке страницы компонент монтируется заново, поэтому будет новое случайное изображение
    const pathChanged = lastPathRef.current !== location.pathname;

    if (!pathChanged && imageSelectedForPathRef.current === location.pathname) {
      // Изображение уже выбрано для этого пути, не меняем
      return;
    }

    lastPathRef.current = location.pathname;
    imageSelectedForPathRef.current = location.pathname;

    // Выбираем изображение из БД
    if (headerImages.length > 0) {
      // Используем изображения из БД - случайный выбор
      const randomIndex = Math.floor(Math.random() * headerImages.length);
      const imageUrl = headerImages[randomIndex];
      console.log('🎲 [Hero] Выбрано изображение:', { index: randomIndex, url: imageUrl });
      const imageSet = generateImageSetFromUrl(imageUrl);
      setBackgroundImage(imageSet);
    } else {
      console.warn('⚠️ [Hero] Нет изображений для отображения (headerImages пустой)');
      setBackgroundImage('');
    }
  }, [location.pathname, headerImages]);

  // Всегда показываем заголовок (с fallback значением)
  const displayName = profileName || 'Смоляное чучелко';

  return (
    <section className="hero" style={{ backgroundImage }}>
      <h1 className="hero__title">{displayName}</h1>
    </section>
  );
}

export default Hero;
