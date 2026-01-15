import type { SyncedLyricsLine } from '@models';

// Простой in-memory кэш для синхронизаций с настраиваемым TTL
interface CacheEntry {
  data: SyncedLyricsLine[] | null;
  expiresAt: number; // Timestamp когда истекает кэш
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL = 30 * 1000; // 30 секунд по умолчанию (уменьшено для быстрого обновления на мобилке)

// Версия кэша для принудительной инвалидации (инкрементируется при очистке)
let cacheVersion = 0;
// Слушатели инвалидации с информацией о треке для фильтрации
interface CacheInvalidationListener {
  callback: (albumId: string, trackId: string | number, lang: string) => void;
  albumId?: string;
  trackId?: string | number;
  lang?: string;
}
const cacheVersionListeners = new Set<CacheInvalidationListener>();

/**
 * Подписывается на изменения версии кэша (для принудительной перезагрузки данных)
 * @param callback - функция, которая будет вызвана при инвалидации кэша
 * @param albumId - опционально: фильтр по albumId
 * @param trackId - опционально: фильтр по trackId
 * @param lang - опционально: фильтр по lang
 */
export function subscribeToCacheInvalidation(
  callback: (albumId: string, trackId: string | number, lang: string) => void,
  albumId?: string,
  trackId?: string | number,
  lang?: string
): () => void {
  const listener: CacheInvalidationListener = { callback, albumId, trackId, lang };
  cacheVersionListeners.add(listener);
  return () => {
    cacheVersionListeners.delete(listener);
  };
}

/**
 * Получает текущую версию кэша (для использования в зависимостях useEffect)
 */
export function getCacheVersion(): number {
  return cacheVersion;
}

// Глобальная очередь запросов для ограничения параллелизма
// Это предотвращает перегрузку Supabase pooler множественными одновременными запросами
interface QueuedRequest {
  resolve: (value: any) => void; // очередь используется и для string (authorship)
  reject: (error: Error) => void;
  execute: () => Promise<any>;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

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

function queueRequest<T>(execute: () => Promise<T>): Promise<T> {
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
  // Проверяем, не истёк ли TTL
  if (now >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return entry.data;
}

function setCachedData(
  key: string,
  data: SyncedLyricsLine[] | null,
  ttlMs: number = DEFAULT_CACHE_TTL
): void {
  const now = Date.now();
  cache.set(key, {
    data,
    expiresAt: now + ttlMs,
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
    cache.clear();
  }

  // ✅ Инкрементируем версию кэша и уведомляем подписчиков для принудительной перезагрузки
  cacheVersion++;
  cacheVersionListeners.forEach((listener) => {
    try {
      // Если указаны фильтры, проверяем соответствие
      if (albumId && trackId && lang) {
        // Очистка для конкретного трека - уведомляем только соответствующих подписчиков
        const matches =
          (!listener.albumId || listener.albumId === albumId) &&
          (!listener.trackId || String(listener.trackId) === String(trackId)) &&
          (!listener.lang || listener.lang === lang);
        if (matches) {
          listener.callback(albumId, trackId, lang);
        }
      } else {
        // Очистка всего кэша - уведомляем всех подписчиков с их параметрами
        if (listener.albumId && listener.trackId && listener.lang) {
          listener.callback(listener.albumId, listener.trackId, listener.lang);
        }
      }
    } catch (error) {
      console.error('Ошибка в callback инвалидации кэша:', error);
    }
  });
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
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch('/api/synced-lyrics', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        ...authHeader,
      },
      body: JSON.stringify(data),
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
          if (text) errorMessage = text.substring(0, 200);
        }
      } catch (parseError) {
        console.warn('⚠️ Не удалось распарсить ответ об ошибке:', parseError);
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
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

      // ✅ обязательно чистим кэш, чтобы не осталась старая версия
      clearSyncedLyricsCache(data.albumId, data.trackId, data.lang);
    }

    return result;
  } catch (error) {
    console.error('❌ Ошибка сохранения синхронизаций:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const message = errorMessage.startsWith('Ошибка сохранения:')
      ? errorMessage
      : `Ошибка сохранения: ${errorMessage}`;
    return { success: false, message };
  }
}

export async function loadSyncedLyricsFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string,
  signal?: AbortSignal
): Promise<SyncedLyricsLine[] | null> {
  const cacheKey = getCacheKey(albumId, trackId, lang);
  const cachedData = getCachedData(cacheKey);
  if (cachedData !== undefined) {
    return cachedData;
  }

  return queueRequest(async () => {
    try {
      const params = new URLSearchParams({
        albumId,
        trackId: String(trackId),
        lang,
      });

      // ✅ Добавляем timestamp для обхода промежуточных кэшей (браузер/CDN)
      params.set('_ts', String(Date.now()));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const finalSignal = signal || controller.signal;

      if (signal) {
        const onAbort = () => {
          controller.abort();
          clearTimeout(timeoutId);
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        const { getAuthHeader } = await import('@shared/lib/auth');
        const authHeader = getAuthHeader();

        const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            ...authHeader,
          },
          signal: finalSignal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // ✅ фикс мобилки: кэшируем null, чтобы старые данные не “жили” бесконечно
          if (response.status === 404) {
            setCachedData(cacheKey, null, 30 * 1000);
            return null;
          }

          // ✅ на 500 тоже кэшируем null, но ненадолго
          if (response.status === 500) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Сервер вернул ошибку 500, пропускаем загрузку синхронизаций');
            }
            setCachedData(cacheKey, null, 10 * 1000);
            return null;
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '⚠️ API возвращает HTML вместо JSON. Функция synced-lyrics не задеплоена на production. Нужно задеплоить проект на Netlify.'
            );
            // можно тоже закэшировать null, чтобы не спамить запросами в dev
            setCachedData(cacheKey, null, 10 * 1000);
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

        // ✅ TTL: синхра/не синхра протухает и мобилка подтягивает актуальное состояние
        // Уменьшен TTL до 30 секунд для быстрого обновления на мобилке
        setCachedData(cacheKey, syncedLyrics, 30 * 1000);

        return syncedLyrics;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Запрос синхронизаций превысил таймаут');
          }
          // кэшируем null кратко, чтобы не долбить сеть при плохом интернете
          setCachedData(cacheKey, null, 5 * 1000);
          return null;
        }
        throw fetchError;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Ошибка загрузки синхронизаций из БД:', error);
      }
      // на любые ошибки — краткий null-кэш, чтобы не спамить
      const cacheKey = getCacheKey(albumId, trackId, lang);
      setCachedData(cacheKey, null, 5 * 1000);
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
  return queueRequest(async () => {
    try {
      const params = new URLSearchParams({
        albumId,
        trackId: String(trackId),
        lang,
      });

      // ✅ Добавляем timestamp для обхода промежуточных кэшей (браузер/CDN)
      params.set('_ts', String(Date.now()));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const finalSignal = signal || controller.signal;

      if (signal) {
        const onAbort = () => {
          controller.abort();
          clearTimeout(timeoutId);
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        const { getAuthHeader } = await import('@shared/lib/auth');
        const authHeader = getAuthHeader();

        const response = await fetch(`/api/synced-lyrics?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            ...authHeader,
          },
          signal: finalSignal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) return null;
          if (response.status === 500) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Сервер вернул ошибку 500, пропускаем загрузку авторства');
            }
            return null;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
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
          return result.data.authorship as string;
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
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Ошибка загрузки авторства из БД:', error);
      }
      return null;
    }
  }).then((result) => (typeof result === 'string' ? result : null));
}
