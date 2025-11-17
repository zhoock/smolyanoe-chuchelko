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
      // Пытаемся получить сообщение об ошибке из ответа
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } else {
          // Если ответ не JSON, пытаемся прочитать как текст
          const text = await response.text();
          if (text) {
            errorMessage = text.substring(0, 200); // Ограничиваем длину сообщения
          }
        }
      } catch (parseError) {
        // Если не удалось распарсить ответ, используем стандартное сообщение
        console.warn('⚠️ Не удалось распарсить ответ об ошибке:', parseError);
      }
      throw new Error(errorMessage);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Убираем дублирование префикса "Ошибка сохранения:"
    const message = errorMessage.startsWith('Ошибка сохранения:')
      ? errorMessage
      : `Ошибка сохранения: ${errorMessage}`;
    return {
      success: false,
      message,
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

    // Добавляем таймаут для запроса (10 секунд)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Синхронизации не найдены
        }
        // Для 500 ошибок не бросаем исключение, просто возвращаем null
        // чтобы не вызывать бесконечные повторные запросы
        if (response.status === 500) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Сервер вернул ошибку 500, пропускаем загрузку синхронизаций');
          }
          return null;
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
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Запрос синхронизаций превысил таймаут');
        }
        return null;
      }
      throw fetchError;
    }
  } catch (error) {
    // Не логируем ошибки как критические, чтобы не засорять консоль
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки синхронизаций из БД:', error);
    }
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

    // Добавляем таймаут для запроса (10 секунд)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Синхронизации не найдены
        }
        // Для 500 ошибок не бросаем исключение, просто возвращаем null
        if (response.status === 500) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Сервер вернул ошибку 500, пропускаем загрузку авторства');
          }
          return null;
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
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Запрос авторства превысил таймаут');
        }
        return null;
      }
      throw fetchError;
    }
  } catch (error) {
    // Не логируем ошибки как критические, чтобы не засорять консоль
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки авторства из БД:', error);
    }
    return null;
  }
}
