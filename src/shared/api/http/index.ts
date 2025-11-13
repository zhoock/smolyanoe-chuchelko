const BASE_URL = 'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/main/src/assets';

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
