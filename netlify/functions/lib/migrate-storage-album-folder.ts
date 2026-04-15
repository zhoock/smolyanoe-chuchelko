/**
 * После смены строкового album_id (slug) переносит объекты в Supabase Storage
 * с users/{userId}/audio/{oldId}/ на users/{userId}/audio/{newId}/ и обновляет пути в tracks.src.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient, STORAGE_BUCKET_NAME } from './supabase';
import { query } from './db';

async function listAllFilePathsRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data?.length) return out;

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    // Папки в Storage: metadata === null; файлы — есть metadata
    if (item.metadata === null) {
      const sub = await listAllFilePathsRecursive(supabase, bucket, itemPath);
      out.push(...sub);
    } else {
      out.push(itemPath);
    }
  }
  return out;
}

async function moveOrCopyStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  fromPath: string,
  toPath: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: moveErr } = await supabase.storage.from(bucket).move(fromPath, toPath);
  if (!moveErr) return { ok: true };

  const { data: fileData, error: downloadErr } = await supabase.storage
    .from(bucket)
    .download(fromPath);
  if (downloadErr || !fileData) {
    return {
      ok: false,
      error: `move failed (${moveErr.message}); download failed: ${downloadErr?.message ?? 'no data'}`,
    };
  }

  const { error: uploadErr } = await supabase.storage.from(bucket).upload(toPath, fileData, {
    upsert: true,
  });
  if (uploadErr) {
    return { ok: false, error: `move failed; upload failed: ${uploadErr.message}` };
  }

  const { error: removeErr } = await supabase.storage.from(bucket).remove([fromPath]);
  if (removeErr) {
    console.warn('[migrate-storage-album-folder] Uploaded to new path but old remove failed:', {
      fromPath,
      removeErr,
    });
  }
  return { ok: true };
}

export async function migrateUserAlbumAudioFolderAfterRename(params: {
  userId: string;
  oldAlbumId: string;
  newAlbumId: string;
}): Promise<{ ok: true; movedFiles: number } | { ok: false; message: string }> {
  const { userId, oldAlbumId, newAlbumId } = params;
  if (oldAlbumId === newAlbumId) return { ok: true, movedFiles: 0 };

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      ok: false,
      message:
        'Supabase admin client unavailable (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)',
    };
  }

  const oldPrefix = `users/${userId}/audio/${oldAlbumId}`;
  const newPrefix = `users/${userId}/audio/${newAlbumId}`;

  let paths: string[] = [];
  try {
    paths = await listAllFilePathsRecursive(supabase, STORAGE_BUCKET_NAME, oldPrefix);
  } catch (e) {
    return {
      ok: false,
      message: `Failed to list storage under ${oldPrefix}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (paths.length === 0) {
    await updateTrackSrcAfterAlbumRename(userId, oldAlbumId, newAlbumId);
    return { ok: true, movedFiles: 0 };
  }

  paths.sort((a, b) => b.length - a.length);

  let movedFiles = 0;
  for (const fromPath of paths) {
    if (!fromPath.startsWith(oldPrefix + '/') && fromPath !== oldPrefix) continue;
    const relative = fromPath === oldPrefix ? '' : fromPath.slice(oldPrefix.length + 1);
    const toPath = relative ? `${newPrefix}/${relative}` : newPrefix;

    const result = await moveOrCopyStorageObject(supabase, STORAGE_BUCKET_NAME, fromPath, toPath);
    if (!result.ok) {
      return {
        ok: false,
        message: `Storage migrate failed for ${fromPath} -> ${toPath}: ${result.error}`,
      };
    }
    movedFiles++;
  }

  try {
    await updateTrackSrcAfterAlbumRename(userId, oldAlbumId, newAlbumId);
  } catch (e) {
    return {
      ok: false,
      message: `Files moved but DB update failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return { ok: true, movedFiles };
}

async function updateTrackSrcAfterAlbumRename(
  userId: string,
  oldAlbumId: string,
  newAlbumId: string
): Promise<void> {
  const usersOld = `users/${userId}/audio/${oldAlbumId}/`;
  const usersNew = `users/${userId}/audio/${newAlbumId}/`;
  const audioOld = `/audio/${oldAlbumId}/`;
  const audioNew = `/audio/${newAlbumId}/`;

  await query(
    `UPDATE tracks t
     SET src = REPLACE(REPLACE(t.src, $2, $3), $4, $5),
         updated_at = CURRENT_TIMESTAMP
     FROM albums a
     WHERE t.album_id = a.id
       AND a.user_id = $1::uuid
       AND a.album_id = $6`,
    [userId, usersOld, usersNew, audioOld, audioNew, newAlbumId]
  );
}
