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
