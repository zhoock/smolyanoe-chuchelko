/**
 * Собирает публичный URL объекта в Supabase Storage по пути в bucket.
 * Использует SUPABASE_URL / VITE_SUPABASE_URL из окружения функции (на Netlify всегда есть SUPABASE_URL).
 */
const STORAGE_BUCKET = 'user-media';

export function resolveTrackSrcToSupabasePublicUrl(
  src: string | null | undefined,
  albumUserId?: string | null
): string | undefined {
  if (src == null || String(src).trim() === '') {
    return undefined;
  }

  const raw = String(src).trim();

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
    /\/$/,
    ''
  );

  if (!supabaseUrl) {
    return raw;
  }

  const base = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}`;

  if (raw.startsWith('users/')) {
    const cleanPath = raw.replace(/^\/+/, '');
    return encodeURI(`${base}/${cleanPath}`);
  }

  if (raw.startsWith('/audio/') && albumUserId) {
    const relative = raw.slice('/audio/'.length).replace(/^\/+/, '');
    const cleanPath = `users/${albumUserId}/audio/${relative}`;
    return encodeURI(`${base}/${cleanPath}`);
  }

  // Относительный путь без ведущего слэша (как в старых данных): albumId/file.ext
  if (!raw.startsWith('/') && albumUserId && !raw.includes('://')) {
    const cleanPath = `users/${albumUserId}/audio/${raw.replace(/^\/+/, '')}`;
    return encodeURI(`${base}/${cleanPath}`);
  }

  return raw;
}
