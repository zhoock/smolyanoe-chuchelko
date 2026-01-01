// src/widgets/hero/ui/Hero.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { loadHeaderImagesFromDatabase } from '@entities/user/lib';
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
  const location = useLocation();
  const lastPathRef = useRef<string>('');
  const imagesLoadedRef = useRef<boolean>(false);
  const imageSelectedForPathRef = useRef<string>('');

  // Загружаем изображения из БД
  useEffect(() => {
    const loadImages = async () => {
      try {
        const images = await loadHeaderImagesFromDatabase();
        setHeaderImages(images);
        imagesLoadedRef.current = true;
      } catch (error) {
        console.warn('⚠️ Ошибка загрузки header images из БД:', error);
        setHeaderImages([]);
        imagesLoadedRef.current = true;
      }
    };
    loadImages();
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

    if (headerImages.length > 0) {
      // Используем изображения из БД - случайный выбор
      const randomIndex = Math.floor(Math.random() * headerImages.length);
      const imageUrl = headerImages[randomIndex];
      const imageSet = generateImageSetFromUrl(imageUrl);
      setBackgroundImage(imageSet);
    }
    // Если в БД нет данных, backgroundImage останется пустым (не будет фона)
  }, [location.pathname, headerImages]);

  return (
    <section className="hero" style={{ backgroundImage }}>
      <h1 className="hero__title">Cмоляное чучелко</h1>
    </section>
  );
}

export default Hero;
