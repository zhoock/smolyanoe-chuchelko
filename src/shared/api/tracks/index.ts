/**
 * API для работы с треками
 */

import { getToken } from '@shared/lib/auth';

export interface TrackUploadData {
  fileName: string;
  title: string;
  duration: number; // в секундах
  trackId: string; // ID трека в альбоме (например, "1", "2")
  orderIndex: number;
  storagePath: string; // Путь к файлу в Storage (после загрузки)
  url: string; // URL файла в Storage (после загрузки)
}

export interface TrackUploadRequest {
  albumId: string; // album_id (строка, например "23"), не UUID
  lang: string; // 'ru' или 'en'
  tracks: TrackUploadData[];
}

export interface TrackUploadResponse {
  success: boolean;
  data?: Array<{
    trackId: string;
    title: string;
    url: string;
    storagePath: string;
  }>;
  error?: string;
}

/**
 * Конвертирует File в base64 строку (без префикса data:...)
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Получает длительность аудиофайла в секундах
 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });

    audio.addEventListener('error', (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio metadata'));
    });

    audio.src = url;
  });
}

/**
 * Загружает треки в базу данных
 */
export async function uploadTracks(
  albumId: string,
  lang: string,
  tracks: TrackUploadData[]
): Promise<TrackUploadResponse> {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'User is not authenticated. Please log in.' };
    }

    const response = await fetch('/api/tracks/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        albumId,
        lang,
        tracks,
      }),
    });

    const json: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      if (typeof json === 'object' && json !== null && 'error' in json) {
        return { success: false, error: (json as { error: string }).error };
      }
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    if (
      typeof json === 'object' &&
      json !== null &&
      'success' in json &&
      json.success === true &&
      'data' in json
    ) {
      return json as TrackUploadResponse;
    }

    return { success: false, error: 'Invalid response shape from upload-tracks' };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Подготавливает и загружает трек
 * Загружает файл в Supabase Storage и возвращает метаданные
 */
export async function prepareAndUploadTrack(
  file: File,
  albumId: string,
  trackId: string,
  orderIndex: number,
  title?: string
): Promise<TrackUploadData> {
  const { uploadFile } = await import('@shared/api/storage');
  const duration = await getAudioDuration(file);

  // Генерируем имя файла: {trackId}.{extension}
  const extension = file.name.split('.').pop() || 'mp3';
  const fileName = `${trackId}.${extension}`;

  // Используем переданное название или имя файла без расширения
  const trackTitle = title || file.name.replace(/\.[^/.]+$/, '');

  // Загружаем файл в Supabase Storage
  // Путь будет: users/{userId}/audio/{albumId}/{fileName}
  const url = await uploadFile({
    category: 'audio',
    file,
    fileName: `${albumId}/${fileName}`, // Включаем albumId в путь
    contentType: file.type || 'audio/mpeg',
  });

  if (!url) {
    throw new Error(`Failed to upload track file: ${fileName}`);
  }

  // Извлекаем storagePath из URL
  // URL имеет формат: https://...supabase.co/storage/v1/object/public/user-media/users/{userId}/audio/{albumId}/{fileName}
  let storagePath: string;
  if (url.includes('/storage/v1/object/public/user-media/')) {
    storagePath = url.split('/storage/v1/object/public/user-media/')[1];
  } else {
    // Если URL через proxy или другой формат, формируем путь вручную
    const { CURRENT_USER_CONFIG } = await import('@config/user');
    storagePath = `users/${CURRENT_USER_CONFIG.userId}/audio/${albumId}/${fileName}`;
  }

  return {
    fileName,
    title: trackTitle,
    duration: Math.round(duration * 100) / 100, // Округляем до 2 знаков после запятой
    trackId,
    orderIndex,
    storagePath,
    url,
  };
}
