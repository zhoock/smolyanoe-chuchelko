export interface SaveTrackTextRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  content: string;
  authorship?: string;
}

export interface SaveTrackTextResponse {
  success: boolean;
  message?: string;
}

export async function saveTrackText(data: SaveTrackTextRequest): Promise<SaveTrackTextResponse> {
  if (process.env.NODE_ENV === 'development') {
    try {
      const key = `track-text-${data.lang}-${data.albumId}-${data.trackId}`;
      localStorage.setItem(key, data.content);

      if (data.authorship !== undefined) {
        const authorshipKey = `track-text-authorship-${data.lang}-${data.albumId}-${data.trackId}`;
        localStorage.setItem(authorshipKey, data.authorship);
      }

      console.log('✅ Текст трека сохранён в localStorage:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: data.content.length,
        hasAuthorship: data.authorship !== undefined,
      });

      return {
        success: true,
        message: 'Текст сохранён в localStorage (dev mode)',
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
    const response = await fetch('/api/save-track-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: SaveTrackTextResponse = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Ошибка сохранения текста:', error);
    return {
      success: false,
      message: `Ошибка сохранения: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function loadTrackTextFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    const key = `track-text-${lang}-${albumId}-${trackId}`;
    return localStorage.getItem(key);
  } catch (error) {
    console.error('❌ Ошибка загрузки текста из localStorage:', error);
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
