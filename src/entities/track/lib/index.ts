import { buildApiUrl } from '@shared/lib/artistQuery';

export { getTrackById } from './getTrackById';

export interface SaveTrackTextRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  translations: Partial<Record<'en' | 'ru', { content: string; authorship?: string }>>;
}

export interface SaveTrackTextResponse {
  success: boolean;
  message?: string;
}

/**
 * Сохраняет текст трека и авторство в базу данных.
 * Всегда сохраняет в БД (и в dev, и в production режиме).
 */
export async function saveTrackText(data: SaveTrackTextRequest): Promise<SaveTrackTextResponse> {
  try {
    // Импортируем динамически, чтобы избежать циклических зависимостей
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch('/api/save-track-text', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        ...authHeader,
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
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } else {
          const text = await response.text();
          if (text) {
            errorMessage = text.substring(0, 200);
          }
        }
      } catch {
        // Если не удалось распарсить ответ, используем стандартное сообщение
      }
      throw new Error(errorMessage);
    }

    const result: SaveTrackTextResponse = await response.json();

    if (process.env.NODE_ENV === 'development') {
      const loc = data.translations?.[data.lang as 'en' | 'ru'];
      console.log('✅ Текст трека сохранён в БД:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: loc?.content?.length ?? 0,
        hasAuthorship: loc?.authorship !== undefined,
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Ошибка сохранения текста:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const message = errorMessage.startsWith('Ошибка сохранения:')
      ? errorMessage
      : `Ошибка сохранения: ${errorMessage}`;
    return {
      success: false,
      message,
    };
  }
}

/**
 * @deprecated localStorage больше не используется для хранения текста треков.
 * Все данные загружаются из базы данных через loadTrackTextFromDatabase.
 * Функция оставлена для обратной совместимости и всегда возвращает null.
 */
export function loadTrackTextFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): string | null {
  return null;
}

/**
 * @deprecated localStorage больше не используется для хранения авторства треков.
 * Все данные загружаются из базы данных через loadAuthorshipFromStorage из @features/syncedLyrics/lib.
 * Функция оставлена для обратной совместимости и всегда возвращает null.
 */
export function loadAuthorshipFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): string | null {
  return null;
}

/**
 * Загружает текст трека из базы данных через API.
 * Текст хранится в synced_lyrics как массив строк с startTime: 0.
 *
 * @returns Пустая строка — в БД явно сохранён пустой текст (очищено в админке).
 *          `null` — записи нет или ответ не удалось разобрать (используйте fallback из JSON).
 */
export async function loadTrackTextFromDatabase(
  albumId: string,
  trackId: string | number,
  lang: string,
  artistSlugForPublicApi?: string | null
): Promise<string | null> {
  try {
    // Импортируем динамически, чтобы избежать циклических зависимостей
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const url = buildApiUrl(
      '/api/synced-lyrics',
      {
        albumId,
        trackId: String(trackId),
        lang,
        _ts: String(Date.now()),
      },
      { includeArtist: true, artistSlugOverride: artistSlugForPublicApi ?? null }
    );

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        Pragma: 'no-cache',
        ...authHeader,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Текст не найден
      }
      return null; // При ошибке возвращаем null
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    const result = await response.json();

    // Если есть синхронизированный текст
    if (result.success && result.data && result.data.syncedLyrics) {
      const syncedLyrics = result.data.syncedLyrics as Array<{ text: string; startTime: number }>;

      // Пустой массив после очистки в админке — не смешивать с «нет данных» (null)
      if (Array.isArray(syncedLyrics) && syncedLyrics.length === 0) {
        return '';
      }

      // Если все строки имеют startTime: 0, это обычный текст (не синхронизированный)
      // Объединяем все строки в один текст
      const isPlainText = syncedLyrics.every((line) => line.startTime === 0);
      if (isPlainText && syncedLyrics.length > 0) {
        return syncedLyrics.map((line) => line.text).join('\n');
      }

      // Если есть синхронизированный текст, но не все строки с startTime: 0
      // Все равно возвращаем текст (для модалки синхронизации нужен исходный текст)
      if (syncedLyrics.length > 0) {
        return syncedLyrics.map((line) => line.text).join('\n');
      }
    }

    // Если синхронизированного текста нет, но есть текст в tracks.content
    // endpoint может вернуть его в другом формате - проверяем content напрямую
    if (result.success && result.data && typeof result.data.content === 'string') {
      return result.data.content;
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки текста из БД:', error);
    }
    return null;
  }
}

export function formatTrackText(text: string): string {
  let formatted = text.replace(/\t/g, ' ');

  formatted = formatted.replace(/,([^\s\n\d])/g, ', $1');
  formatted = formatted.replace(/;([^\s\n])/g, '; $1');
  formatted = formatted.replace(/:([^\s\n])/g, ': $1');

  formatted = formatted.replace(/[ ]+/g, ' ');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  formatted = formatted
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  return formatted.trim();
}

export function splitTextIntoLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim().length > 0);
}

export function countLines(text: string): number {
  return splitTextIntoLines(text).length;
}
