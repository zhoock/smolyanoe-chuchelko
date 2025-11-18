/**
 * Утилиты для работы с профилем пользователя
 */

export interface UserProfile {
  theBand: string[];
}

export interface UserProfileResponse {
  success: boolean;
  data?: {
    theBand: string[];
  } | null;
  error?: string;
}

/**
 * Загружает описание группы (theBand) из БД для текущего пользователя
 * @param lang - язык интерфейса
 * @returns массив строк с описанием группы или null, если пользователь не авторизован или данных нет
 */
export async function loadTheBandFromDatabase(lang: string): Promise<string[] | null> {
  try {
    const response = await fetch(`/api/user-profile?lang=${lang}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        // TODO: Добавить Authorization header когда будет реализована аутентификация
        // 'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Пользователь не найден
      }
      return null; // При ошибке возвращаем null (будет использован JSON fallback)
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    const result: UserProfileResponse = await response.json();

    if (result.success && result.data && result.data.theBand) {
      return result.data.theBand;
    }

    // Если данных нет (result.data === null), возвращаем null для использования JSON fallback
    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Ошибка загрузки theBand из БД:', error);
    }
    return null;
  }
}

/**
 * Сохраняет описание группы (theBand) в БД для текущего пользователя
 * @param theBand - массив строк с описанием группы
 * @returns результат сохранения
 */
export async function saveTheBandToDatabase(
  theBand: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/user-profile', {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        // TODO: Добавить Authorization header когда будет реализована аутентификация
        // 'Authorization': `Bearer ${token}`,
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
