/**
 * Типы и утилиты для пользовательских путей и медиа.
 */

export type ImageCategory =
  | 'albums'
  | 'articles'
  | 'profile'
  | 'uploads'
  | 'stems'
  | 'audio'
  | 'hero';

/**
 * Получает UUID текущего авторизованного пользователя
 * Возвращает null если пользователь не авторизован
 */
export function getUserUserId(): string | null {
  // SSR - возвращаем null
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const authModule = require('@shared/lib/auth');
    const getUser = authModule.getUser;

    if (!getUser) {
      console.warn('[getUserUserId] getUser function not found');
      return null;
    }

    const user = getUser();
    const userId = user?.id || null;

    return userId;
  } catch (error) {
    console.warn('[getUserUserId] Failed to get user ID:', error);
    return null;
  }
}
