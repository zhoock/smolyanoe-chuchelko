/**
 * Серверный конфиг Supabase для Netlify Functions
 * Не использует import.meta.env (работает только с process.env)
 *
 * Clients are cached on globalThis — same reason as lib/db.ts (one instance per process).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __appSupabaseAnonClient: SupabaseClient | null | undefined;
  // eslint-disable-next-line no-var
  var __appSupabaseAdminClient: SupabaseClient | null | undefined;
}

export const STORAGE_BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'user-media';

const SUPABASE_CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * Создает Supabase anon client (для публичных операций)
 */
export function createSupabaseAnonClient(): SupabaseClient | null {
  if (globalThis.__appSupabaseAnonClient !== undefined) {
    return globalThis.__appSupabaseAnonClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ [supabase] Supabase credentials not found');
    globalThis.__appSupabaseAnonClient = null;
    return null;
  }

  try {
    globalThis.__appSupabaseAnonClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      SUPABASE_CLIENT_OPTIONS
    );
    return globalThis.__appSupabaseAnonClient;
  } catch (error) {
    console.error('❌ [supabase] Failed to create Supabase anon client:', error);
    globalThis.__appSupabaseAnonClient = null;
    return null;
  }
}

/**
 * Создает Supabase admin client с service role key (для операций с Storage)
 * ⚠️ Безопасность: НЕ используем VITE_* переменные (только server env)
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  if (globalThis.__appSupabaseAdminClient !== undefined) {
    return globalThis.__appSupabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ [supabase] Supabase credentials not found', {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
    });
    globalThis.__appSupabaseAdminClient = null;
    return null;
  }

  try {
    globalThis.__appSupabaseAdminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      SUPABASE_CLIENT_OPTIONS
    );
    return globalThis.__appSupabaseAdminClient;
  } catch (error) {
    console.error('❌ [supabase] Failed to create Supabase admin client:', error);
    globalThis.__appSupabaseAdminClient = null;
    return null;
  }
}
