// src/widgets/hero/ui/Hero.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { loadHeaderImagesFromDatabase } from '@entities/user/lib';
import { getToken } from '@shared/lib/auth';
import { buildApiUrl } from '@shared/lib/artistQuery';
import {
  Universe3D,
  type SceneArtist,
  UNIVERSE_FOCUS_ARTIST_STORAGE_KEY,
} from '@/components/view/Universe3D';
import '@/components/view/Universe3D.style.scss';
import './style.scss';

const HERO_CLUSTER_PALETTE = [0x4d80ff, 0xff8a47, 0x53d8a2, 0xb086ff, 0xf2cd5d, 0x5ec9f5] as const;

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
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isImagesLoading, setIsImagesLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const heroCanvasRef = useRef<HTMLDivElement | null>(null);
  const lastPathRef = useRef<string>('');
  const imagesLoadedRef = useRef<boolean>(false);
  const imageSelectedForPathRef = useRef<string>('');
  const hasArtistParam = !!searchParams.get('artist');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');

  // Загружаем изображения из БД
  useEffect(() => {
    const loadImages = async () => {
      setIsImagesLoading(true);
      imagesLoadedRef.current = false;
      setHeaderImages([]);
      setBackgroundImage('');

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
      } finally {
        setIsImagesLoading(false);
      }
    };
    loadImages();
  }, [location.search]);

  // Загружаем название группы:
  // - public (/ и /?artist=...): всегда из API public профиля, без JWT
  // - admin (/dashboard): из профиля текущего JWT пользователя
  useEffect(() => {
    const loadProfileName = async () => {
      setIsProfileLoading(true);
      setProfileName('');

      if (!isDashboardRoute) {
        try {
          const response = await fetch(
            buildApiUrl('/api/user-profile', {}, { includeArtist: true }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const result = await response.json();
            const profileName = result.success
              ? (result.data?.siteName ?? result.data?.name ?? '')
              : '';
            setProfileName(profileName);
          } else {
            setProfileName('');
          }
        } catch (error) {
          console.warn('⚠️ Ошибка загрузки названия группы выбранного артиста:', error);
          setProfileName('');
        } finally {
          setIsProfileLoading(false);
        }
        return;
      }

      try {
        const token = getToken();
        if (!token) {
          setProfileName('');
          return;
        }

        const response = await fetch(
          buildApiUrl('/api/user-profile', {}, { includeArtist: false }),
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          const profileName = result.success
            ? (result.data?.name ?? result.data?.siteName ?? '')
            : '';
          setProfileName(profileName);
        } else {
          setProfileName('');
        }
      } catch (error) {
        console.warn('⚠️ Ошибка загрузки названия группы в админке:', error);
        setProfileName('');
      } finally {
        setIsProfileLoading(false);
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
  }, [hasArtistParam, isDashboardRoute, location.pathname, location.search]);

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

      // Проверяем и исправляем localhost URL перед установкой
      let cleanImageUrl = imageUrl;
      if (
        imageUrl &&
        (imageUrl.includes('localhost') ||
          imageUrl.includes('127.0.0.1') ||
          imageUrl.includes(':8080'))
      ) {
        // Извлекаем path из URL
        const pathMatch = imageUrl.match(/[?&]path=([^&]+)/);
        if (pathMatch) {
          const path = decodeURIComponent(pathMatch[1]);
          const hostname = window.location.hostname;
          const protocol = window.location.protocol;
          const port = window.location.port;

          const isProduction =
            hostname !== 'localhost' &&
            hostname !== '127.0.0.1' &&
            !hostname.includes('localhost') &&
            !hostname.includes('127.0.0.1') &&
            !hostname.includes(':8080') &&
            (hostname.includes('smolyanoechuchelko.ru') || hostname.includes('netlify.app'));

          const origin = isProduction
            ? `${protocol}//${hostname}${port && port !== '8080' ? `:${port}` : ''}`
            : window.location.origin;
          const proxyPath = isProduction ? '/api/proxy-image' : '/.netlify/functions/proxy-image';
          cleanImageUrl = `${origin}${proxyPath}?path=${encodeURIComponent(path)}`;

          console.log('🔄 [Hero] Исправлен localhost URL:', {
            old: imageUrl,
            new: cleanImageUrl,
          });
        }
      }

      // Преобразуем URL в формат для background-image (простой url(), без image-set)
      const backgroundImageUrl = formatBackgroundImageUrl(cleanImageUrl);
      setBackgroundImage(backgroundImageUrl);

      // Предзагружаем выбранное изображение для улучшения производительности
      if (imageUrl && !imageUrl.startsWith('url(')) {
        const cleanUrl = imageUrl.replace(/^url\(['"]?|['"]?\)$/g, '');
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = cleanUrl;

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

      // Предзагружаем все остальные изображения для быстрого переключения
      // Это особенно важно для мобильных устройств
      headerImages.forEach((url, index) => {
        if (index !== randomIndex && url && !url.startsWith('url(')) {
          const cleanUrl = url.replace(/^url\(['"]?|['"]?\)$/g, '');
          // Создаем Image объект для предзагрузки (более надежно, чем link preload)
          const img = new Image();
          img.src = cleanUrl;
          // Не добавляем обработчики ошибок, чтобы не засорять консоль
          // Изображение просто загрузится в кэш браузера
        }
      });
    } else {
      console.warn('⚠️ [Hero] Нет изображений для отображения (headerImages пустой)');
      setBackgroundImage('');
    }
  }, [location.pathname, headerImages]);

  // Для artist-режима не подставляем дефолтное имя, чтобы не смешивать данные.
  // Для default-режима сохраняем текущее поведение.
  const isArtistLoading = hasArtistParam && (isProfileLoading || isImagesLoading);
  const displayName = hasArtistParam
    ? isArtistLoading
      ? ''
      : profileName || ''
    : profileName || 'Смоляное чучелко';

  const artistParamKey = searchParams.get('artist')?.trim() ?? '';

  /** Latest profile/header for canvas fallback without re-running Universe3D effect. */
  const profileNameForCanvasRef = useRef(profileName);
  const headerImagesForCanvasRef = useRef(headerImages);
  profileNameForCanvasRef.current = profileName;
  headerImagesForCanvasRef.current = headerImages;

  useEffect(() => {
    if (!hasArtistParam || !artistParamKey) return;
    const el = heroCanvasRef.current;
    if (!el) return;
    if (el.childElementCount > 0) return;

    let universe: Universe3D | null = null;
    let cancelled = false;

    const run = async () => {
      let sceneArtist: SceneArtist | null = null;
      let allPublicArtists: SceneArtist[] = [];

      try {
        const response = await fetch('/api/public-artists');
        const payload = (await response.json()) as { success?: boolean; data?: SceneArtist[] };
        if (response.ok && payload.success && Array.isArray(payload.data)) {
          allPublicArtists = payload.data;
          sceneArtist = payload.data.find((a) => a.publicSlug?.trim() === artistParamKey) ?? null;
        }
      } catch {
        // ignore: fallback artist below
      }

      if (cancelled || !heroCanvasRef.current) return;

      const profileNameNow = profileNameForCanvasRef.current;
      const headerImagesNow = headerImagesForCanvasRef.current;

      if (!sceneArtist) {
        sceneArtist = {
          name: profileNameNow || artistParamKey,
          publicSlug: artistParamKey,
          genreCode: 'other',
          headerImages: headerImagesNow.length > 0 ? [...headerImagesNow] : undefined,
        };
      } else if (headerImagesNow.length > 0) {
        sceneArtist = {
          ...sceneArtist,
          headerImages:
            sceneArtist.headerImages && sceneArtist.headerImages.length > 0
              ? sceneArtist.headerImages
              : [...headerImagesNow],
        };
      }

      if (allPublicArtists.length > 0) {
        const grouped = new Map<string, SceneArtist[]>();
        allPublicArtists.forEach((a) => {
          const g = a.genreCode || 'other';
          const b = grouped.get(g) ?? [];
          b.push(a);
          grouped.set(g, b);
        });
        const genres = Array.from(grouped.keys());
        const gi = sceneArtist.genreCode || 'other';
        const gIdx = genres.indexOf(gi);
        const paletteIdx = gIdx >= 0 ? gIdx : 0;
        sceneArtist = {
          ...sceneArtist,
          clusterColor: HERO_CLUSTER_PALETTE[paletteIdx % HERO_CLUSTER_PALETTE.length],
        };
      }

      if (cancelled || !heroCanvasRef.current) return;
      if (heroCanvasRef.current.childElementCount > 0) return;

      universe = new Universe3D(heroCanvasRef.current, [sceneArtist], {
        disableCameraControls: true,
        embedInContainer: true,
        isHeroPreview: true,
      });
    };

    void run();

    return () => {
      cancelled = true;
      universe?.destroy();
      el.replaceChildren();
    };
  }, [artistParamKey]);

  return (
    <section
      className={hasArtistParam ? 'hero hero--navigate-home' : 'hero'}
      style={{ backgroundImage: backgroundImage || undefined }}
      onClick={
        hasArtistParam
          ? () => {
              if (artistParamKey) {
                sessionStorage.setItem(UNIVERSE_FOCUS_ARTIST_STORAGE_KEY, artistParamKey);
              }
              navigate('/');
            }
          : undefined
      }
    >
      {hasArtistParam && <div ref={heroCanvasRef} className="hero__canvas" />}
      <h1 className="hero__title">{displayName}</h1>
    </section>
  );
}

export default Hero;
