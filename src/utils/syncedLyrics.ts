// src/utils/syncedLyrics.ts
/**
 * Утилиты для работы с синхронизированным текстом песен.
 * Сохранение синхронизаций в API или localStorage (для разработки).
 */
import type { SyncedLyricsLine } from '../models';

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

/**
 * Сохраняет синхронизированный текст песни.
 *
 * В режиме разработки (development) сохраняет в localStorage.
 * В продакшене должен отправлять запрос на API endpoint.
 *
 * @param data - данные синхронизации для сохранения
 * @returns Promise с результатом сохранения
 */
export async function saveSyncedLyrics(
  data: SaveSyncedLyricsRequest
): Promise<SaveSyncedLyricsResponse> {
  // В режиме разработки сохраняем в localStorage
  if (process.env.NODE_ENV === 'development') {
    try {
      const key = `synced-lyrics-${data.lang}-${data.albumId}-${data.trackId}`;
      localStorage.setItem(key, JSON.stringify(data.syncedLyrics));

      // Сохраняем авторство отдельно (используем тот же ключ, что и в trackText.ts)
      if (data.authorship !== undefined) {
        const authorshipKey = `track-text-authorship-${data.lang}-${data.albumId}-${data.trackId}`;
        localStorage.setItem(authorshipKey, data.authorship);
      }

      console.log('✅ Синхронизации сохранены в localStorage:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        linesCount: data.syncedLyrics.length,
        hasAuthorship: data.authorship !== undefined,
      });

      return {
        success: true,
        message: 'Синхронизации сохранены в localStorage (dev mode)',
      };
    } catch (error) {
      console.error('❌ Ошибка сохранения в localStorage:', error);
      return {
        success: false,
        message: `Ошибка сохранения: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // В продакшене отправляем на API endpoint
  try {
    const response = await fetch('/api/save-synced-lyrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: SaveSyncedLyricsResponse = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Ошибка сохранения синхронизаций:', error);
    return {
      success: false,
      message: `Ошибка сохранения: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Загружает синхронизированный текст из localStorage (для разработки).
 * В продакшене должен загружаться из API или из основного JSON файла.
 */
export function loadSyncedLyricsFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): SyncedLyricsLine[] | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    const key = `synced-lyrics-${lang}-${albumId}-${trackId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    return JSON.parse(stored) as SyncedLyricsLine[];
  } catch (error) {
    console.error('❌ Ошибка загрузки из localStorage:', error);
    return null;
  }
}

/**
 * Загружает авторство из localStorage (для разработки).
 * В продакшене должно загружаться из API или из основного JSON файла.
 *
 * ВАЖНО: Использует тот же ключ, что и trackText.ts для унификации.
 */
export function loadAuthorshipFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    // Используем тот же ключ, что и в trackText.ts для единообразия
    const key = `track-text-authorship-${lang}-${albumId}-${trackId}`;
    // Также проверяем старый ключ для обратной совместимости
    const oldKey = `synced-lyrics-authorship-${lang}-${albumId}-${trackId}`;
    return localStorage.getItem(key) || localStorage.getItem(oldKey);
  } catch (error) {
    console.error('❌ Ошибка загрузки авторства из localStorage:', error);
    return null;
  }
}
