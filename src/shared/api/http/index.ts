const safeEnv =
  typeof process !== 'undefined' && process.env ? process.env : ({} as NodeJS.ProcessEnv);
const rawAssetsBase = safeEnv.VITE_RAW_ASSETS_BASE_URL;

const BASE_URL =
  safeEnv.NODE_ENV === 'production' && rawAssetsBase?.trim()
    ? rawAssetsBase.trim().replace(/\/$/, '')
    : '/assets';

export async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}/${path}`, {
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}. Status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // Запрос был отменён — возвращаем незавершённый промис,
      // чтобы React Router не трактовал отмену как ошибку загрузчика.
      return new Promise<T>(() => {});
    }
    throw error;
  }
}
