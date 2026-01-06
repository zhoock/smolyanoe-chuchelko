/**
 * Серверный конфиг Supabase для Netlify Functions
 * Не использует import.meta.env (работает только с process.env)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'user-media';

/**
 * Создает Supabase anon client (для публичных операций)
 */
export function createSupabaseAnonClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ [supabase] Supabase credentials not found');
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('❌ [supabase] Failed to create Supabase anon client:', error);
    return null;
  }
}

/**
 * Создает Supabase admin client с service role key (для операций с Storage)
 * ⚠️ Безопасность: НЕ используем VITE_* переменные (только server env)
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ [supabase] Supabase credentials not found');
    return null;
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('❌ [supabase] Failed to create Supabase admin client:', error);
    return null;
  }
}
