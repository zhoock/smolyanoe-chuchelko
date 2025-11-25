/**
 * Конфигурация текущего пользователя
 * В будущем это может быть динамическим значением из контекста/Redux
 */
export const CURRENT_USER_CONFIG = {
  userId: 'zhoock',
  username: 'yaroslav_zhoock',
} as const;

export type ImageCategory = 'albums' | 'articles' | 'profile' | 'uploads' | 'stems';
