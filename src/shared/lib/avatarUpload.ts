/** Лимит размера **исходного** файла до генерации вариантов (категория profile) — согласовано с netlify upload-file */
export const AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_FILE_SIZE_MB = 2;

/** Суффикс канонического варианта (меньший квадрат) — имя файла = `profile-<id>-128.webp` */
export const AVATAR_CANONICAL_SIZE_SUFFIX = '-128.webp';

/**
 * Имя объекта в Storage — это вариант аватара (не `cover-*` в той же папке).
 * Учитывает: `profile.jpg`, фиксированные `profile-128.webp`, и `profile-<hex>-128.webp`.
 */
export function isProfileAvatarStorageObjectName(name: string): boolean {
  if (!name || name.toLowerCase().startsWith('cover-')) return false;
  if (/^profile\.(jpe?g|png|webp)$/i.test(name)) return true;
  if (/^profile-\d{3}\.(jpe?g|webp)$/i.test(name)) return true;
  if (/^profile-[a-f0-9]+-\d{3}\.(jpe?g|webp)$/i.test(name)) return true;
  return false;
}

/**
 * Добавляет query `t` для сброса кэша.
 * URL вида `...?path=...` (уже с `?`) — используем `&t=...`, иначе `?t=...`, иначе `?t=...` попадёт внутрь `path` в proxy.
 */
export function appendUrlCacheBustParam(url: string, bust: string): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${bust}`;
}

/**
 * URL варианта 256px из URL 128px (тот же query/proxy).
 * Поддерживает `...profile-128.webp` (старый фиксированный) и `...profile-<id>-128.webp`.
 */
export function profileAvatarRetinaUrlFrom1x(avatar1xUrl: string): string | null {
  if (typeof avatar1xUrl !== 'string' || !avatar1xUrl) return null;
  if (avatar1xUrl.toLowerCase().includes('/images/avatar')) return null;
  if (!/-128\.(webp|jpe?g)(?=[?#]|$)/i.test(avatar1xUrl)) return null;
  return avatar1xUrl.replace(
    /-128\.(webp|jpe?g)(?=[?#]|$)/i,
    (_m, ext: string) => `-256.${ext.toLowerCase()}`
  );
}
