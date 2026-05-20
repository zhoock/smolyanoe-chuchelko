/**
 * Удаление всех файлов пользователя из Supabase Storage (prefix users/{userId}/).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient, STORAGE_BUCKET_NAME } from './supabase';

async function listAllFilePathsRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
  });
  if (error) {
    throw new Error(`Storage list failed: ${error.message}`);
  }
  if (!data?.length) return out;

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.metadata === null) {
      const sub = await listAllFilePathsRecursive(supabase, bucket, itemPath);
      out.push(...sub);
    } else {
      out.push(itemPath);
    }
  }
  return out;
}

export async function deleteAllUserStorageFiles(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error('Storage service is not configured');
  }

  const prefix = `users/${userId}`;
  const paths = await listAllFilePathsRecursive(supabase, STORAGE_BUCKET_NAME, prefix);
  if (paths.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(STORAGE_BUCKET_NAME).remove(batch);
    if (error) {
      throw new Error(`Storage remove failed: ${error.message}`);
    }
  }
}
