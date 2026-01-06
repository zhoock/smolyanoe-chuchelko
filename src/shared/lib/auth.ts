/**
 * Клиентские утилиты для работы с аутентификацией
 */

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: AuthUser;
  };
  error?: string;
  message?: string;
}

/**
 * Сохраняет токен и данные пользователя в localStorage
 */
export function saveAuth(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('❌ Failed to save auth data:', error);
  }
}

/**
 * Получает токен из localStorage
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('❌ Failed to get token:', error);
    return null;
  }
}

/**
 * Получает данные пользователя из localStorage
 */
export function getUser(): AuthUser | null {
  try {
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    if (!userStr) return null;
    return JSON.parse(userStr) as AuthUser;
  } catch (error) {
    console.error('❌ Failed to get user:', error);
    return null;
  }
}

/**
 * Удаляет токен и данные пользователя из localStorage
 */
export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error('❌ Failed to clear auth data:', error);
  }
}

/**
 * Проверяет, авторизован ли пользователь
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Регистрация нового пользователя
 */
export async function register(
  email: string,
  password: string,
  siteName: string
): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name: siteName, siteName }),
    });

    const result: AuthResponse = await response.json();

    if (result.success && result.data) {
      saveAuth(result.data.token, result.data.user);
      // Сохраняем siteName в localStorage для использования в Hero
      localStorage.setItem('profile-name', siteName);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Вход пользователя
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const result: AuthResponse = await response.json();

    if (result.success && result.data) {
      saveAuth(result.data.token, result.data.user);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Выход пользователя
 */
export function logout(): void {
  clearAuth();
}

/**
 * Получает заголовок Authorization для API запросов
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}
