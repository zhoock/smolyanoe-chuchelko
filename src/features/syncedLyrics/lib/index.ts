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
  try {
    const response = await fetch('/api/synced-lyrics', {
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

    const response = await fetch(`/api/synced-lyrics?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Синхронизации не найдены
      }
      throw new Error(`HTTP error! status: ${response.status}`);
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

    const response = await fetch(`/api/synced-lyrics?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Синхронизации не найдены
      }
      throw new Error(`HTTP error! status: ${response.status}`);
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
