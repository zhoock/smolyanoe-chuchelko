import { uniqueUploadFileSuffix } from './uniqueUploadFileSuffix';

/**
 * Безопасное имя файла для Storage (латиница, без пробелов и спецсимволов).
 * Не даёт пустого basename и вариантов вроде `.png`, `_.png` (имя без «тела» перед расширением).
 */
export function sanitizeFileName(name: string): string {
  let out = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');

  // Только точки по краям: "......png" → "png", ".png" → "png"
  out = out.replace(/^\.+|\.+$/g, '');

  const lastDot = out.lastIndexOf('.');
  let base: string;
  let ext = '';

  if (lastDot > 0 && lastDot < out.length - 1) {
    const possibleExt = out.slice(lastDot + 1);
    if (/^[a-z0-9]{1,8}$/.test(possibleExt)) {
      base = out.slice(0, lastDot);
      ext = out.slice(lastDot);
    } else {
      base = out;
    }
  } else {
    base = out;
  }

  // Обрезаем бессмысленные `_`, `.`, `-` у basename (не трогаем расширение)
  base = base.replace(/^[._-]+|[._-]+$/g, '');

  if (!base || /^_+$/.test(base)) {
    base = `file_${uniqueUploadFileSuffix()}`;
  }

  const result = `${base}${ext}`;
  return result || `file_${uniqueUploadFileSuffix()}`;
}
