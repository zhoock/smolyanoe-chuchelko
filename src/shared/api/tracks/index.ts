/**
 * API для работы с треками
 */

import { getToken } from '@shared/lib/auth';

export interface TrackUploadData {
  fileBase64: string;
  fileName: string;
  title: string;
  duration: number; // в секундах
  trackId: string; // ID трека в альбоме (например, "1", "2")
  orderIndex: number;
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
 * Подготавливает данные трека для загрузки
 */
export async function prepareTrackForUpload(
  file: File,
  trackId: string,
  orderIndex: number,
  title?: string
): Promise<TrackUploadData> {
  const fileBase64 = await fileToBase64(file);
  const duration = await getAudioDuration(file);

  // Генерируем имя файла: {trackId}.{extension} (трек будет в папке альбома)
  const extension = file.name.split('.').pop() || 'mp3';
  const fileName = `${trackId}.${extension}`;

  // Используем переданное название или имя файла без расширения
  const trackTitle = title || file.name.replace(/\.[^/.]+$/, '');

  return {
    fileBase64,
    fileName,
    title: trackTitle,
    duration: Math.round(duration * 100) / 100, // Округляем до 2 знаков после запятой
    trackId,
    orderIndex,
  };
}
