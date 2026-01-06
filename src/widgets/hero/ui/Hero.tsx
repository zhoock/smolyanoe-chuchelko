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
    return baseUrl.replace(/\n\s*/g, ' ').trim();
  }

  // Если это локальный путь (начинается с /images/), возвращаем простой URL
  if (baseUrl.startsWith('/images/')) {
    return `url('${baseUrl}')`;
  }

  // Извлекаем путь к файлу из URL
  let storagePath = '';
  let baseName = '';

  // Проверяем разные форматы URL
  if (baseUrl.includes('proxy-image')) {
    // URL через proxy-image: /.netlify/functions/proxy-image?path=users%2Fzhoock%2Fhero%2Fhero-123-1920.jpg
    const pathMatch = baseUrl.match(/[?&]path=([^&]+)/);
    if (pathMatch) {
      try {
        storagePath = decodeURIComponent(pathMatch[1]);
        // Извлекаем имя файла из пути
        const fileName = storagePath.split('/').pop() || '';
        // Извлекаем базовое имя (hero-123 из hero-123-1920.jpg)
        const nameMatch = fileName.match(/(.+)-(\d+)\.(jpg|webp|avif)$/);
        if (nameMatch) {
          baseName = nameMatch[1];
        }
      } catch (e) {
        console.warn('⚠️ [Hero] Ошибка декодирования path:', e);
        return `url('${baseUrl}')`;
      }
    }
  } else if (baseUrl.includes('supabase.co/storage')) {
    // Прямой Supabase URL: https://xxx.supabase.co/storage/v1/object/public/user-media/users/zhoock/hero/hero-123-1920.jpg
    const storageMatch = baseUrl.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    if (storageMatch) {
      storagePath = storageMatch[1];
      const fileName = storagePath.split('/').pop() || '';
      const nameMatch = fileName.match(/(.+)-(\d+)\.(jpg|webp|avif)$/);
      if (nameMatch) {
        baseName = nameMatch[1];
      }
    }
  } else {
    // Простой путь: users/zhoock/hero/hero-123-1920.jpg
    storagePath = baseUrl;
    const fileName = storagePath.split('/').pop() || '';
    const nameMatch = fileName.match(/(.+)-(\d+)\.(jpg|webp|avif)$/);
    if (nameMatch) {
      baseName = nameMatch[1];
    }
  }

  // Если не удалось извлечь базовое имя, возвращаем URL как есть
  if (!baseName || !storagePath) {
    console.warn('⚠️ [Hero] Не удалось распарсить URL, используем как есть:', baseUrl);
    return `url('${baseUrl}')`;
  }

  // Определяем базовый путь (без имени файла)
  const pathParts = storagePath.split('/');
  pathParts.pop(); // Убираем имя файла
  const basePath = pathParts.join('/');

  // Определяем origin для proxy-image
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Генерируем варианты для image-set (форматы: avif, webp, jpg)
  const formats = ['avif', 'webp', 'jpg'];
  const size = 1920; // Используем только 1920px вариант
  const variants: string[] = [];

  for (const format of formats) {
    const fileName = `${baseName}-${size}.${format}`;
    const imagePath = `${basePath}/${fileName}`;

    let variantUrl = '';
    if (baseUrl.includes('proxy-image') || !baseUrl.includes('supabase.co')) {
      // Используем proxy-image для лучшей совместимости
      variantUrl = `${origin}/.netlify/functions/proxy-image?path=${encodeURIComponent(imagePath)}`;
    } else {
      // Используем прямой Supabase URL
      const supabaseBase = baseUrl.match(
        /(https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\/)/
      );
      variantUrl = supabaseBase ? `${supabaseBase[1]}${imagePath}` : baseUrl;
    }

    const mimeType =
      format === 'avif' ? 'image/avif' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    variants.push(`url('${variantUrl}') type('${mimeType}')`);
  }

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

        // Фильтруем только изображения из папки hero, удаляем старые из articles
        const validHeroImages = (images || []).filter((url) => {
          // Проверяем, что путь содержит '/hero/' или '/users/zhoock/hero'
          const isValidHero =
            url.includes('/hero/') ||
            url.includes('/hero-') ||
            (url.includes('proxy-image') && url.includes('hero'));

          if (!isValidHero) {
            console.warn('⚠️ [Hero] Найдено изображение не из папки hero, пропускаем:', url);
          }

          return isValidHero;
        });

        if (validHeroImages.length > 0) {
          setHeaderImages(validHeroImages);
          console.log('✅ [Hero] Валидные hero изображения:', validHeroImages.length);
        } else {
          console.warn(
            '⚠️ [Hero] Header images не найдены в БД или все из неправильной папки (пустой массив)'
          );
          // Принудительно очищаем изображения, если в БД их нет
          setHeaderImages([]);
          setBackgroundImage('');
        }
        imagesLoadedRef.current = true;
      } catch (error) {
        console.error('❌ [Hero] Ошибка загрузки header images из БД:', error);
        setHeaderImages([]);
        setBackgroundImage('');
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

    // Слушаем событие обновления header images
    const handleHeaderImagesUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{ images: string[] }>;
      const newImages = customEvent.detail?.images;
      if (Array.isArray(newImages)) {
        console.log('🔄 [Hero] Получено событие обновления header images:', newImages);
        setHeaderImages(newImages);
        imagesLoadedRef.current = true;
        // Если массив пустой, сразу очищаем фон
        if (newImages.length === 0) {
          setBackgroundImage('');
        }
      }
    };

    window.addEventListener('profile-name-updated', handleProfileNameUpdate);
    window.addEventListener('header-images-updated', handleHeaderImagesUpdate);

    return () => {
      window.removeEventListener('profile-name-updated', handleProfileNameUpdate);
      window.removeEventListener('header-images-updated', handleHeaderImagesUpdate);
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
