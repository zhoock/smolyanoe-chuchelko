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
  if (process.env.NODE_ENV === 'development') {
    try {
      const key = `synced-lyrics-${data.lang}-${data.albumId}-${data.trackId}`;
      localStorage.setItem(key, JSON.stringify(data.syncedLyrics));

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

export function loadAuthorshipFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    const key = `track-text-authorship-${lang}-${albumId}-${trackId}`;
    const oldKey = `synced-lyrics-authorship-${lang}-${albumId}-${trackId}`;
    return localStorage.getItem(key) || localStorage.getItem(oldKey);
  } catch (error) {
    console.error('❌ Ошибка загрузки авторства из localStorage:', error);
    return null;
  }
}

