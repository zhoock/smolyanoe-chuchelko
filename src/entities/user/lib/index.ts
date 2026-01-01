/**
 * Утилиты для работы с профилем пользователя и данными текущего пользователя
 */

export interface UserProfile {
  theBand: string[];
  headerImages?: string[];
}

export interface UserProfileResponse {
  success: boolean;
  data?: {
    theBand: string[];
    headerImages?: string[];
  } | null;
  error?: string;
}

/**
 * Загружает описание группы (theBand) из БД для текущего пользователя
 */
export async function loadTheBandFromDatabase(lang: string): Promise<string[] | null> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch(`/api/user-profile?lang=${lang}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    const result: UserProfileResponse = await response.json();

    if (result.success && result.data && result.data.theBand) {
      return result.data.theBand;
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки theBand из БД:', error);
    }
    return null;
  }
}

/**
 * Загружает описание группы (theBand) из статического JSON файла профиля
 */
export async function loadTheBandFromProfileJson(lang: string): Promise<string[] | null> {
  try {
    const { getJSON } = await import('@shared/api/http');
    const profile = await getJSON<{ theBand: { [key: string]: string[] } }>('profile.json');

    if (profile?.theBand?.[lang] && Array.isArray(profile.theBand[lang])) {
      return profile.theBand[lang].filter(Boolean);
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки theBand из profile.json:', error);
    }
    return null;
  }
}

/**
 * Загружает изображения для шапки (header images) из БД для текущего пользователя
 */
export async function loadHeaderImagesFromDatabase(): Promise<string[]> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch('/api/user-profile', {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
    });

    if (!response.ok) {
      return [];
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return [];
    }

    const result: UserProfileResponse = await response.json();

    if (result.success && result.data && result.data.headerImages) {
      return result.data.headerImages;
    }

    return [];
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки header images из БД:', error);
    }
    return [];
  }
}

/**
 * Сохраняет изображения для шапки (header images) в БД для текущего пользователя
 */
export async function saveHeaderImagesToDatabase(
  headerImages: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    // Загружаем текущие данные профиля
    const currentTheBand = (await loadTheBandFromDatabase('ru')) || [];

    const response = await fetch('/api/user-profile', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
      body: JSON.stringify({
        theBand: currentTheBand,
        headerImages,
      }),
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
          if (text) {
            errorMessage = text.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Не удалось распарсить ответ об ошибке:', parseError);
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type: expected JSON');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Сохраняет описание группы (theBand) в БД для текущего пользователя
 */
export async function saveTheBandToDatabase(
  theBand: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { getAuthHeader } = await import('@shared/lib/auth');
    const authHeader = getAuthHeader();

    const response = await fetch('/api/user-profile', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...authHeader,
      },
      body: JSON.stringify({ theBand }),
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
          if (text) {
            errorMessage = text.substring(0, 200);
          }
        }
      } catch (parseError) {
        console.warn('⚠️ Не удалось распарсить ответ об ошибке:', parseError);
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type: expected JSON');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
