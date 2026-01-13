// src/widgets/hero/ui/Hero.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { loadHeaderImagesFromDatabase } from '@entities/user/lib';
import { getToken } from '@shared/lib/auth';
import './style.scss';

/**
 * Преобразует URL изображения в формат для background-image
 * Всегда возвращает простой url(), так как многие браузеры не поддерживают image-set в inline style
 * @param imageUrl - URL изображения (может быть proxy URL или уже в формате url())
 * @returns простой URL в формате url('...')
 */
function formatBackgroundImageUrl(imageUrl: string): string {
  if (!imageUrl || !imageUrl.trim()) {
    return '';
  }

  // Если это уже правильный формат url('...'), возвращаем как есть
  if (imageUrl.startsWith("url('") || imageUrl.startsWith('url("')) {
    return imageUrl;
  }

  // Если это image-set, извлекаем первый доступный URL (jpg приоритет)
  if (imageUrl.includes('image-set')) {
    const jpgMatch = imageUrl.match(/url\(["']([^"']+\.jpg[^"']*)["']\)/);
    if (jpgMatch && jpgMatch[1]) {
      return `url('${jpgMatch[1]}')`;
    }
    const webpMatch = imageUrl.match(/url\(["']([^"']+\.webp[^"']*)["']\)/);
    if (webpMatch && webpMatch[1]) {
      return `url('${webpMatch[1]}')`;
    }
    const firstMatch = imageUrl.match(/url\(["']([^"']+)["']\)/);
    if (firstMatch && firstMatch[1]) {
      return `url('${firstMatch[1]}')`;
    }
  }

  // Для обычного URL просто оборачиваем в url()
  return `url('${imageUrl}')`;
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
        // Для публичных страниц не передаем useAuth=true, API вернет данные админа
        const images = await loadHeaderImagesFromDatabase(false);
        console.log('📸 [Hero] Загружены header images из БД:', images);

        // Фильтруем только изображения из папки hero, удаляем старые из articles
        const validHeroImages = (images || []).filter((url) => {
          // Проверяем, что путь содержит '/hero/' (работает для любого userId, включая UUID)
          const isValidHero =
            url.includes('/hero/') ||
            url.includes('/hero-') ||
            (url.includes('proxy-image') && url.includes('hero')) ||
            (url.includes('users/') && url.includes('/hero/'));

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

      // Преобразуем URL в формат для background-image (простой url(), без image-set)
      const backgroundImageUrl = formatBackgroundImageUrl(imageUrl);
      setBackgroundImage(backgroundImageUrl);

      // Предзагружаем изображение для улучшения производительности
      if (imageUrl && !imageUrl.startsWith('url(')) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = imageUrl;

        // Добавляем только один preload link за раз
        const existingLink = document.querySelector('link[rel="preload"][as="image"]');
        if (existingLink) {
          existingLink.remove();
        }

        document.head.appendChild(link);

        // Очищаем link через 10 секунд
        setTimeout(() => {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
        }, 10000);
      }
    } else {
      console.warn('⚠️ [Hero] Нет изображений для отображения (headerImages пустой)');
      setBackgroundImage('');
    }
  }, [location.pathname, headerImages]);

  // Всегда показываем заголовок (с fallback значением)
  const displayName = profileName || 'Смоляное чучелко';

  return (
    <section className="hero" style={{ backgroundImage: backgroundImage || undefined }}>
      <h1 className="hero__title">{displayName}</h1>
    </section>
  );
}

export default Hero;
