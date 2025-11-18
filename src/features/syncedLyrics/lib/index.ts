import type { SyncedLyricsLine } from '@models';

// Простой in-memory кэш для синхронизаций (TTL: 5 минут)
interface CacheEntry {
  data: SyncedLyricsLine[] | null;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут в миллисекундах

// Глобальная очередь запросов для ограничения параллелизма
// Это предотвращает перегрузку Supabase pooler множественными одновременными запросами
interface QueuedRequest {
  resolve: (value: SyncedLyricsLine[] | null) => void;
  reject: (error: Error) => void;
  execute: () => Promise<SyncedLyricsLine[] | null>;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;
const MAX_CONCURRENT_REQUESTS = 1; // Только 1 запрос одновременно

async function processQueue(): Promise<void> {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (!request) break;

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error instanceof Error ? error : new Error('Unknown error'));
    }

    // Задержка между запросами для снижения нагрузки на pooler
    if (requestQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  isProcessingQueue = false;
}

function queueRequest(
  execute: () => Promise<SyncedLyricsLine[] | null>
): Promise<SyncedLyricsLine[] | null> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, execute });
    processQueue();
  });
}

function getCacheKey(albumId: string, trackId: string | number, lang: string): string {
  return `${albumId}-${trackId}-${lang}`;
}

function getCachedData(key: string): SyncedLyricsLine[] | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }

  return entry.data;
}

function setCachedData(key: string, data: SyncedLyricsLine[] | null): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Очищает кэш синхронизаций для конкретного трека или всех данных.
 * Вызывайте после сохранения синхронизаций, чтобы обновить данные.
 */
export function clearSyncedLyricsCache(
  albumId?: string,
  trackId?: string | number,
  lang?: string
): void {
  if (albumId && trackId && lang) {
    const key = getCacheKey(albumId, trackId, lang);
    cache.delete(key);
  } else {
    // Очищаем весь кэш
    cache.clear();
  }
}

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
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch('/api/synced-lyrics', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...authHeader,
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
      // Очищаем кэш для этого трека, чтобы при следующей загрузке получить актуальные данные
      clearSyncedLyricsCache(data.albumId, data.trackId, data.lang);
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
  lang: string,
  signal?: AbortSignal
): Promise<SyncedLyricsLine[] | null> {
  // Проверяем кэш
  const cacheKey = getCacheKey(albumId, trackId, lang);
  const cachedData = getCachedData(cacheKey);
  if (cachedData !== undefined) {
    return cachedData;
  }

  // Добавляем запрос в очередь для ограничения параллелизма
  return queueRequest(async () => {
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

      // Если передан signal извне, объединяем его с таймаутом
      // Используем внешний signal, если он есть, иначе используем controller
      const finalSignal = signal || controller.signal;

      // Если передан внешний signal, отменяем наш controller при его отмене
      if (signal) {
        signal.addEventListener('abort', () => {
          controller.abort();
          clearTimeout(timeoutId);
        });
      }

      try {
        // Импортируем динамически, чтобы избежать циклических зависимостей
        const { getAuthHeader } = await import('@shared/lib/auth');
        const authHeader = getAuthHeader();

        const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            ...authHeader,
          },
          signal: finalSignal,
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

        let syncedLyrics: SyncedLyricsLine[] | null = null;
        if (result.success && result.data && result.data.syncedLyrics) {
          syncedLyrics = result.data.syncedLyrics as SyncedLyricsLine[];
        }

        // Сохраняем в кэш (включая null для 404)
        setCachedData(cacheKey, syncedLyrics);

        return syncedLyrics;
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
  });
}

export async function loadAuthorshipFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string,
  signal?: AbortSignal
): Promise<string | null> {
  // Добавляем запрос в очередь для ограничения параллелизма
  return queueRequest(async () => {
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

      // Если передан signal извне, объединяем его с таймаутом
      const finalSignal = signal || controller.signal;
      if (signal) {
        signal.addEventListener('abort', () => {
          controller.abort();
          clearTimeout(timeoutId);
        });
      }

      try {
        // Импортируем динамически, чтобы избежать циклических зависимостей
        const { getAuthHeader } = await import('@shared/lib/auth');
        const authHeader = getAuthHeader();

        const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            ...authHeader,
          },
          signal: finalSignal,
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
  }).then((result) => (typeof result === 'string' ? result : null));
}
