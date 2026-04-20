import { sanitizeFileName } from '../../../src/shared/lib/sanitizeFileName';

export { sanitizeFileName };

/** Полный путь `users/...` не меняем. */
export function sanitizeUploadFileName(fileName: string): string {
  if (fileName.startsWith('users/')) {
    return fileName;
  }
  return sanitizeFileName(fileName);
}
