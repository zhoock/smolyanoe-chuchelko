import type { SyncedLyricsLine } from '@models';

export interface SaveSyncedLyricsRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  syncedLyrics: SyncedLyricsLine[];
  authorship?: string;
}

export interface SaveSyncedLyricsResponse {
  success: boolean;
  message?: string;
}

export async function saveSyncedLyrics(
  data: SaveSyncedLyricsRequest
): Promise<SaveSyncedLyricsResponse> {
  // Сохраняем в БД через API
  // В dev режиме запросы проксируются через webpack dev server на production
  // В production используются относительные пути через redirects в netlify.toml
  try {
    const response = await fetch('/api/synced-lyrics', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Проверяем, что ответ действительно JSON, а не HTML
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // В dev режиме, если функция не задеплоена на production, возвращаем ошибку
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '⚠️ API возвращает HTML вместо JSON. Функция synced-lyrics не задеплоена на production. Нужно задеплоить проект на Netlify.'
        );
        return {
          success: false,
          message:
            'Функция synced-lyrics не задеплоена на production. Нужно задеплоить проект на Netlify.',
        };
      }
      const text = await response.text();
      console.error('❌ Ожидался JSON, но получен:', contentType, text.substring(0, 100));
      throw new Error(
        `Invalid content type: ${contentType}. Возможно, прокси не работает правильно.`
      );
    }

    const result: SaveSyncedLyricsResponse = await response.json();

    if (result.success) {
      console.log('✅ Синхронизации сохранены в БД:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        linesCount: data.syncedLyrics.length,
        hasAuthorship: data.authorship !== undefined,
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Ошибка сохранения синхронизаций:', error);
    return {
      success: false,
      message: `Ошибка сохранения: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function loadSyncedLyricsFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): Promise<SyncedLyricsLine[] | null> {
  // Загружаем из БД через API
  try {
    const params = new URLSearchParams({
      albumId,
      trackId: String(trackId),
      lang,
    });

    const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Синхронизации не найдены
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Проверяем, что ответ действительно JSON, а не HTML
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // В dev режиме, если функция не задеплоена на production, просто возвращаем null
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '⚠️ API возвращает HTML вместо JSON. Функция synced-lyrics не задеплоена на production. Нужно задеплоить проект на Netlify.'
        );
        return null;
      }
      const text = await response.text();
      console.error('❌ Ожидался JSON, но получен:', contentType, text.substring(0, 100));
      throw new Error(
        `Invalid content type: ${contentType}. Возможно, прокси не работает правильно.`
      );
    }

    const result = await response.json();

    if (result.success && result.data && result.data.syncedLyrics) {
      return result.data.syncedLyrics as SyncedLyricsLine[];
    }

    return null;
  } catch (error) {
    console.error('❌ Ошибка загрузки синхронизаций из БД:', error);
    return null;
  }
}

export async function loadAuthorshipFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): Promise<string | null> {
  // Загружаем из БД через API
  try {
    const params = new URLSearchParams({
      albumId,
      trackId: String(trackId),
      lang,
    });

    const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Синхронизации не найдены
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Проверяем, что ответ действительно JSON, а не HTML
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // В dev режиме, если функция не задеплоена на production, просто возвращаем null
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '⚠️ API возвращает HTML вместо JSON. Функция synced-lyrics не задеплоена на production. Нужно задеплоить проект на Netlify.'
        );
        return null;
      }
      const text = await response.text();
      console.error('❌ Ожидался JSON, но получен:', contentType, text.substring(0, 100));
      throw new Error(
        `Invalid content type: ${contentType}. Возможно, прокси не работает правильно.`
      );
    }

    const result = await response.json();

    if (result.success && result.data && result.data.authorship) {
      return result.data.authorship;
    }

    return null;
  } catch (error) {
    console.error('❌ Ошибка загрузки авторства из БД:', error);
    return null;
  }
}
