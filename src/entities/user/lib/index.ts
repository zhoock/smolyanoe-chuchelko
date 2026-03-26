/**
 * Утилиты для работы с профилем пользователя и данными текущего пользователя
 */
import { buildApiUrl } from '@shared/lib/artistQuery';

export interface UserProfile {
  theBand: string[];
  headerImages?: string[];
}

export interface UserProfileResponse {
  success: boolean;
  data?: {
    theBand: string[];
    headerImages?: string[];
  } | null;
  error?: string;
}

interface UserProfileLoadOptions {
  includeArtist?: boolean;
  useAuth?: boolean;
}

/**
 * Загружает описание группы (theBand) из БД для текущего пользователя
 */
export async function loadTheBandFromDatabase(
  lang: string,
  options: UserProfileLoadOptions = {}
): Promise<string[] | null> {
  try {
    const includeArtist = options.includeArtist ?? true;
    const useAuth = options.useAuth ?? false;
    let authHeader = {};
    if (useAuth) {
      const { getAuthHeader } = await import('@shared/lib/auth');
      authHeader = getAuthHeader();
    }

    const response = await fetch(buildApiUrl('/api/user-profile', { lang }, { includeArtist }), {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    const result: UserProfileResponse = await response.json();

    if (result.success && result.data && result.data.theBand) {
      return result.data.theBand;
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки theBand из БД:', error);
    }
    return null;
  }
}

/**
 * Загружает описание группы (theBand) из статического JSON файла профиля
 */
export async function loadTheBandFromProfileJson(lang: string): Promise<string[] | null> {
  try {
    const { getJSON } = await import('@shared/api/http');
    const profile = await getJSON<{ theBand: { [key: string]: string[] } }>('profile.json');

    if (profile?.theBand?.[lang] && Array.isArray(profile.theBand[lang])) {
      return profile.theBand[lang].filter(Boolean);
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки theBand из profile.json:', error);
    }
    return null;
  }
}

/**
 * Загружает изображения для шапки (header images) из БД для текущего пользователя
 */
export async function loadHeaderImagesFromDatabase(
  useAuth: boolean = false,
  options: UserProfileLoadOptions = {}
): Promise<string[]> {
  try {
    const includeArtist = options.includeArtist ?? true;
    // Для публичных страниц не передаем Authorization header
    // API вернет данные админа для публичного доступа
    let authHeader = {};
    if (useAuth) {
      const { getAuthHeader } = await import('@shared/lib/auth');
      authHeader = getAuthHeader();
    }

    console.log('📡 [loadHeaderImagesFromDatabase] Отправляем запрос к /api/user-profile', {
      useAuth,
      hasAuth: useAuth && 'Authorization' in authHeader && !!authHeader.Authorization,
    });

    const response = await fetch(buildApiUrl('/api/user-profile', {}, { includeArtist }), {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        ...authHeader,
      },
    });

    console.log('📡 [loadHeaderImagesFromDatabase] Ответ получен:', {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      console.warn('⚠️ [loadHeaderImagesFromDatabase] Запрос не успешен:', response.status);
      return [];
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('⚠️ [loadHeaderImagesFromDatabase] Неверный content-type:', contentType);
      return [];
    }

    const result: UserProfileResponse = await response.json();
    console.log('📡 [loadHeaderImagesFromDatabase] Результат:', {
      success: result.success,
      hasData: !!result.data,
      headerImages: result.data?.headerImages,
      headerImagesLength: result.data?.headerImages?.length || 0,
    });

    if (result.success && result.data && result.data.headerImages) {
      // Преобразуем storagePath в proxy URL, если необходимо
      const convertedImages = result.data.headerImages.map((url) => {
        // Если URL уже содержит localhost или 127.0.0.1, всегда заменяем на текущий origin
        if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes(':8080')) {
          // Извлекаем path из URL (может быть в query параметре или в самом URL)
          let path = '';
          const pathMatch = url.match(/[?&]path=([^&]+)/);
          if (pathMatch) {
            path = decodeURIComponent(pathMatch[1]);
          } else if (url.startsWith('users/')) {
            // Если это просто storagePath без query параметров
            path = url;
          }

          if (path) {
            // Определяем origin и proxy path
            let origin = '';
            let proxyPath = '';

            if (typeof window !== 'undefined') {
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

              if (isProduction) {
                origin = `${protocol}//${hostname}${port && port !== '8080' ? `:${port}` : ''}`;
                proxyPath = '/api/proxy-image';
              } else {
                origin = window.location.origin;
                proxyPath = '/.netlify/functions/proxy-image';
              }
            } else {
              origin = process.env.NETLIFY_SITE_URL || '';
              proxyPath = '/api/proxy-image';
            }

            const newUrl = `${origin}${proxyPath}?path=${encodeURIComponent(path)}`;
            console.log(
              '🔄 [loadHeaderImagesFromDatabase] Заменен localhost URL на текущий origin:',
              {
                old: url,
                new: newUrl,
                path,
                origin,
              }
            );
            return newUrl;
          }
        }

        // Если это storagePath (начинается с "users/"), преобразуем в proxy URL
        if (url.startsWith('users/') && url.includes('/hero/')) {
          // Извлекаем путь к файлу из storagePath
          // Формат: users/{userId}/hero/hero-123-1920.jpg
          // Для обратной совместимости поддерживаем и users/zhoock/hero/ и users/{UUID}/hero/

          // Определяем origin более надежным способом
          let origin = '';
          if (typeof window !== 'undefined') {
            // Используем window.location для определения origin
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            const port = window.location.port;

            // Проверяем, является ли это production доменом
            const isProduction =
              hostname !== 'localhost' &&
              hostname !== '127.0.0.1' &&
              !hostname.includes('localhost') &&
              !hostname.includes('127.0.0.1') &&
              (hostname.includes('smolyanoechuchelko.ru') || hostname.includes('netlify.app'));

            if (isProduction) {
              // В production используем полный URL с протоколом
              origin = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
            } else {
              // В development используем текущий origin
              origin = window.location.origin;
            }
          } else {
            origin = process.env.NETLIFY_SITE_URL || '';
          }

          // Определяем правильный путь для proxy
          // В production используем /api/proxy-image, в localhost - /.netlify/functions/proxy-image
          const isProduction =
            typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            !window.location.hostname.includes('localhost') &&
            !window.location.hostname.includes('127.0.0.1') &&
            (window.location.hostname.includes('smolyanoechuchelko.ru') ||
              window.location.hostname.includes('netlify.app'));

          const proxyPath = isProduction ? '/api/proxy-image' : '/.netlify/functions/proxy-image';

          const proxyUrl = `${origin}${proxyPath}?path=${encodeURIComponent(url)}`;
          console.log('🔄 [loadHeaderImagesFromDatabase] Преобразован storagePath в proxy URL:', {
            original: url,
            converted: proxyUrl,
            isProduction,
            origin,
            hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
          });
          return proxyUrl;
        }
        // Если уже proxy URL или Supabase URL, возвращаем как есть
        return url;
      });

      console.log('✅ [loadHeaderImagesFromDatabase] Header images после преобразования:', {
        originalCount: result.data.headerImages.length,
        convertedCount: convertedImages.length,
        convertedImages,
      });

      return convertedImages;
    }

    console.warn('⚠️ [loadHeaderImagesFromDatabase] Header images не найдены в ответе');
    return [];
  } catch (error) {
    console.error('❌ [loadHeaderImagesFromDatabase] Ошибка загрузки header images из БД:', error);
    return [];
  }
}

/**
 * Сохраняет изображения для шапки (header images) в БД для текущего пользователя
 */
export async function saveHeaderImagesToDatabase(
  headerImages: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    // Не загружаем theBand при сохранении headerImages, чтобы не перезаписывать его
    // API обработает это корректно, сохранив только headerImages
    const response = await fetch('/api/user-profile', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
      body: JSON.stringify({
        headerImages,
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } else {
          const text = await response.text();
          if (text) {
            errorMessage = text.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Не удалось распарсить ответ об ошибке:', parseError);
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type: expected JSON');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Загружает описание группы (theBand) для обоих языков из БД
 * Используется в админ-панели для отображения обоих версий
 */
export async function loadTheBandBilingualFromDatabase(): Promise<{
  ru: string[] | null;
  en: string[] | null;
}> {
  try {
    const [ruData, enData] = await Promise.all([
      loadTheBandFromDatabase('ru'),
      loadTheBandFromDatabase('en'),
    ]);

    return {
      ru: ruData,
      en: enData,
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки bilingual theBand из БД:', error);
    }
    return { ru: null, en: null };
  }
}

/**
 * Сохраняет описание группы (theBand) в БД для текущего пользователя
 * Поддерживает как старый формат (один массив), так и новый (отдельно ru/en)
 */
export async function saveTheBandToDatabase(
  theBand: string[] | { ru: string[]; en: string[] },
  lang?: 'ru' | 'en'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    // Определяем формат данных
    let requestBody: { theBand?: string[]; theBandRu?: string[]; theBandEn?: string[] };

    if (Array.isArray(theBand)) {
      // Старый формат или сохранение одного языка
      if (lang) {
        // Сохраняем только указанный язык
        requestBody = lang === 'ru' ? { theBandRu: theBand } : { theBandEn: theBand };
      } else {
        // Для обратной совместимости: сохраняем оба языка одинаково
        requestBody = { theBand };
      }
    } else {
      // Новый формат: объект с ru и en
      requestBody = {
        theBandRu: theBand.ru,
        theBandEn: theBand.en,
      };
    }

    const response = await fetch('/api/user-profile', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } else {
          const text = await response.text();
          if (text) {
            errorMessage = text.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Не удалось распарсить ответ об ошибке:', parseError);
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type: expected JSON');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
