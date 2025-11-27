/**
 * Конфигурация Supabase клиента
 *
 * Для работы нужны переменные окружения (см. документацию)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Получаем URL и ключ из переменных окружения
// Для клиентской части (React) используем VITE_ префикс
// Для серверной части (Netlify Functions) используем без префикса
const getSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Клиентская часть - используем import.meta.env (поддерживается через webpack DefinePlugin)
    return import.meta.env.VITE_SUPABASE_URL || '';
  }
  // Серверная часть (Netlify Functions) - используем VITE_ переменные
  return process.env.VITE_SUPABASE_URL || '';
};

const getSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    // Клиентская часть - используем import.meta.env (поддерживается через webpack DefinePlugin)
    return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }
  // Серверная часть (Netlify Functions) - используем VITE_ переменные
  return process.env.VITE_SUPABASE_ANON_KEY || '';
};

// Кеш для клиентов Supabase (singleton pattern)
// Ключ - это строка, представляющая конфигурацию клиента (URL + ключ + authToken)
const clientCache = new Map<string, SupabaseClient>();

/**
 * Создает и возвращает Supabase клиент
 * Использует singleton pattern для предотвращения создания множественных экземпляров
 * @param options - опции для создания клиента (например, auth token)
 * @returns Supabase клиент или null, если переменные окружения не установлены
 */
export function createSupabaseClient(options?: { authToken?: string }): SupabaseClient | null {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  // Проверяем наличие переменных окружения
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Supabase credentials not found. Please set required environment variables.');
    }
    // Возвращаем null вместо создания клиента с пустыми значениями
    return null;
  }

  // Создаем ключ для кеша на основе конфигурации
  // Для клиентов с authToken создаем отдельные экземпляры
  const cacheKey = options?.authToken
    ? `${supabaseUrl}:${supabaseAnonKey}:token:${options.authToken}`
    : `${supabaseUrl}:${supabaseAnonKey}:default`;

  // Проверяем, есть ли уже клиент в кеше
  const cachedClient = clientCache.get(cacheKey);
  if (cachedClient) {
    return cachedClient;
  }

  const clientOptions: {
    auth?: {
      persistSession?: boolean;
      autoRefreshToken?: boolean;
      detectSessionInUrl?: boolean;
    };
  } = {};

  // Если передан токен авторизации, используем его
  if (options?.authToken) {
    clientOptions.auth = {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

  // Устанавливаем токен авторизации, если передан
  if (options?.authToken) {
    void client.auth.setSession({
      access_token: options.authToken,
      refresh_token: '',
    });
  }

  // Сохраняем клиент в кеш
  clientCache.set(cacheKey, client);

  return client;
}

/**
 * Дефолтный Supabase клиент для использования в приложении
 * Может быть null, если переменные окружения не установлены
 */
export const supabase = createSupabaseClient();

/**
 * Создает Supabase клиент с service role key (обходит RLS политики)
 * ⚠️ ВАЖНО: Использовать ТОЛЬКО на сервере/в скриптах, НИКОГДА на клиенте!
 * @returns Supabase клиент с service role key или null, если переменные не установлены
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey =
    typeof window !== 'undefined'
      ? import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
      : process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '⚠️ Supabase service role key not found. Please set VITE_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable.'
      );
    }
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Имя бакета для хранения медиа-файлов пользователей (изображения и аудио)
 */
export const STORAGE_BUCKET_NAME = 'user-media';
