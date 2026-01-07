/**
 * Конфигурация текущего пользователя
 * В будущем это может быть динамическим значением из контекста/Redux
 */
export const CURRENT_USER_CONFIG = {
  // DEPRECATED: Используйте getUserUserId() для получения UUID
  // После миграции на UUID используем UUID вместо 'zhoock' для fallback
  userId: 'af97f741-8dae-410b-94a6-3f828f9140a4', // UUID пользователя zhoock@zhoock.ru
  username: 'yaroslav_zhoock',
} as const;

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
    // Используем динамический импорт для избежания циклических зависимостей
    // Но используем обычный import вместо require для лучшей совместимости
    const authModule = require('@shared/lib/auth');
    const getUser = authModule.getUser;

    if (!getUser) {
      console.warn('[getUserUserId] getUser function not found');
      return null;
    }

    const user = getUser();
    const userId = user?.id || null;

    // Убираем логирование для предотвращения бесконечных циклов
    // Если нужно отладить, используйте React DevTools или добавьте breakpoint
    // if (userId) {
    //   console.log('[getUserUserId] Found user ID:', userId.substring(0, 8) + '...');
    // } else {
    //   console.log('[getUserUserId] No user ID found, will use fallback');
    // }

    return userId;
  } catch (error) {
    console.warn('[getUserUserId] Failed to get user ID:', error);
    return null;
  }
}

export type ImageCategory =
  | 'albums'
  | 'articles'
  | 'profile'
  | 'uploads'
  | 'stems'
  | 'audio'
  | 'hero';
