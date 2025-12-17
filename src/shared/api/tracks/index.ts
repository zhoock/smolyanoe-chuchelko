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
 * Подготавливает и загружает трек напрямую в Supabase Storage
 * Загружает файл напрямую, минуя Netlify Functions, чтобы избежать проблем с размером
 */
export async function prepareAndUploadTrack(
  file: File,
  albumId: string,
  trackId: string,
  orderIndex: number,
  title?: string
): Promise<TrackUploadData> {
  const { createSupabaseClient, STORAGE_BUCKET_NAME } = await import('@config/supabase');
  const { getToken } = await import('@shared/lib/auth');
  const { CURRENT_USER_CONFIG } = await import('@config/user');

  const token = getToken();
  if (!token) {
    throw new Error('User is not authenticated. Please log in.');
  }

  const duration = await getAudioDuration(file);

  // Генерируем имя файла: {trackId}.{extension}
  const extension = file.name.split('.').pop() || 'mp3';
  const fileName = `${trackId}.${extension}`;

  // Используем переданное название или имя файла без расширения
  const trackTitle = title || file.name.replace(/\.[^/.]+$/, '');

  // Используем существующий клиент из кеша или создаём новый с токеном
  // Это предотвращает создание множественных экземпляров GoTrueClient
  let supabase = createSupabaseClient({ authToken: token });
  if (!supabase) {
    throw new Error('Failed to create Supabase client. Please check environment variables.');
  }

  // Убеждаемся, что токен установлен в клиенте
  // Проверяем текущую сессию и устанавливаем токен, если нужно
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token || sessionData.session.access_token !== token) {
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '',
    });
  }

  // Формируем путь в Storage: users/{userId}/audio/{albumId}/{fileName}
  const userId = CURRENT_USER_CONFIG.userId;
  const storagePath = `users/${userId}/audio/${albumId}/${fileName}`;

  console.log('📤 [prepareAndUploadTrack] Starting upload:', {
    fileName,
    storagePath,
    fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    fileType: file.type,
    albumId,
    trackId,
  });

  // Загружаем файл напрямую в Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type || 'audio/mpeg',
      upsert: true,
      cacheControl: 'public, max-age=31536000, immutable',
    });

  if (error) {
    console.error('❌ [prepareAndUploadTrack] Upload error:', {
      error: error.message,
      statusCode: (error as any).statusCode,
      errorCode: (error as any).error,
      storagePath,
      fileName,
    });
    throw new Error(`Failed to upload track file: ${error.message}`);
  }

  console.log('✅ [prepareAndUploadTrack] File uploaded successfully:', {
    fileName,
    storagePath,
    uploadData: data,
  });

  // Получаем публичный URL
  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded track');
  }

  console.log('✅ [prepareAndUploadTrack] Got public URL:', {
    fileName,
    url: urlData.publicUrl,
  });

  return {
    fileName,
    title: trackTitle,
    duration: Math.round(duration * 100) / 100, // Округляем до 2 знаков после запятой
    trackId,
    orderIndex,
    storagePath,
    url: urlData.publicUrl,
  };
}
