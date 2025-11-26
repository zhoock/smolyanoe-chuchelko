/**
 * Конфигурация Supabase клиента
 *
 * Для работы нужны переменные окружения:
 * - VITE_SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL для Next.js)
 * - VITE_SUPABASE_ANON_KEY (или NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * В Netlify Functions используйте:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
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
  // Серверная часть (Netlify Functions)
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
};

const getSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    // Клиентская часть - используем import.meta.env (поддерживается через webpack DefinePlugin)
    return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }
  // Серверная часть (Netlify Functions)
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
};

/**
 * Создает и возвращает Supabase клиент
 * @param options - опции для создания клиента (например, auth token)
 * @returns Supabase клиент или null, если переменные окружения не установлены
 */
export function createSupabaseClient(options?: { authToken?: string }): SupabaseClient | null {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  // Проверяем наличие переменных окружения
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '⚠️ Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
      );
    }
    // Возвращаем null вместо создания клиента с пустыми значениями
    return null;
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

  return client;
}

/**
 * Дефолтный Supabase клиент для использования в приложении
 * Может быть null, если переменные окружения не установлены
 */
export const supabase = createSupabaseClient();

/**
 * Имя бакета для хранения изображений пользователей
 */
export const STORAGE_BUCKET_NAME = 'user-images';
