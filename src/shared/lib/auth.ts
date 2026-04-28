/**
 * Клиентские утилиты для работы с аутентификацией
 */

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

/** Синхронизация UI после login/logout (localStorage `auth_user` в той же вкладке storage-событие не шлёт). */
export const AUTH_SESSION_CHANGED_EVENT = 'auth-session-changed';

function dispatchAuthSessionChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

/**
 * Подписка на смену аккаунта в этой вкладке (`saveAuth` / `clearAuth`) и в других (`storage`).
 * Нужна для `useSyncExternalStore`: при смене `auth_user` без полного перезагрузки React иначе
 * не перерисуется и эффекты с `userId` не сработают.
 */
export function subscribeAuthSession(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const run = () => callback();
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, run);
  const onStorage = (e: StorageEvent) => {
    if (e.key === USER_STORAGE_KEY || e.key === TOKEN_STORAGE_KEY || e.key === null) run();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, run);
    window.removeEventListener('storage', onStorage);
  };
}

/** Стабильный ключ сессии для сравнения в `useSyncExternalStore` (смена id/email). */
export function getAuthSessionIdentityKey(): string {
  const u = getUser();
  if (!u) return '';
  return `${u.id}\0${u.email}`;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  /** Роль с бэкенда; старые сессии могут не иметь поля */
  role?: 'user' | 'admin';
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
    dispatchAuthSessionChanged();
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
 * Обновляет имя пользователя в localStorage (auth_user)
 */
export function updateStoredUserName(name: string | null): void {
  try {
    const user = getUser();
    if (!user) return;
    const updatedUser: AuthUser = { ...user, name };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
  } catch (error) {
    console.error('❌ Failed to update stored user name:', error);
  }
}

/**
 * Удаляет токен и данные пользователя из localStorage
 */
export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    dispatchAuthSessionChanged();
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
