/**
 * Netlify Serverless Function для загрузки файлов в Supabase Storage
 *
 * Использование:
 * POST /api/upload-file
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * Body: {
 *   fileBase64: string (base64 encoded file),
 *   fileName: string,
 *   userId?: string (опционально, по умолчанию из токена),
 *   category: 'albums' | 'articles' | 'profile' | 'uploads' | 'stems',
 *   contentType?: string (опционально, по умолчанию 'image/jpeg')
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import type { ImageCategory } from '../../src/config/user';
import { CURRENT_USER_CONFIG } from '../../src/config/user';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  parseJsonBody,
} from './lib/api-helpers';

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
  // В Netlify Functions переменные с префиксом VITE_ недоступны
  // Используем переменные без префикса для серверных функций
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase credentials not found', {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
    });
    return null;
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('❌ Failed to create Supabase admin client:', error);
    return null;
  }
}

interface UploadFileRequest {
  fileBase64: string;
  fileName: string;
  userId?: string;
  category: ImageCategory;
  contentType?: string;
  originalFileSize?: number; // Размер оригинального файла для проверки
  originalFileName?: string; // Имя оригинального файла для логирования
}

interface UploadFileResponse {
  success: boolean;
  url?: string;
  error?: string;
}

function getStoragePath(userId: string, category: ImageCategory, fileName: string): string {
  return `users/${userId}/${category}/${fileName}`;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Проверяем авторизацию
    const userId = requireAuth(event);
    if (!userId) {
      return createErrorResponse(401, 'Unauthorized. Please provide a valid token.');
    }

    // Парсим JSON body
    const body = parseJsonBody<Partial<UploadFileRequest>>(event.body, {});

    const { fileBase64, fileName, category, contentType, originalFileSize } = body;

    if (!fileBase64 || !fileName || !category) {
      return createErrorResponse(400, 'Missing required fields: fileBase64, fileName, category');
    }

    // Используем userId из токена или из запроса (если указан)
    const targetUserId = body.userId || userId;

    // Проверяем, что пользователь загружает только в свою папку
    if (targetUserId !== userId && targetUserId !== CURRENT_USER_CONFIG.userId) {
      return createErrorResponse(403, 'Forbidden. You can only upload to your own folder.');
    }

    // Создаём Supabase клиент с service role key (обходит RLS)
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse(
        500,
        'Supabase admin client is not available. Please check environment variables.'
      );
    }

    // Декодируем base64 в Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64');

    // Проверяем размер файла
    const receivedSize = fileBuffer.length;
    if (originalFileSize && Math.abs(receivedSize - originalFileSize) > 100) {
      console.warn('File size mismatch:', {
        originalFileSize,
        receivedSize,
        difference: Math.abs(receivedSize - originalFileSize),
      });
    }

    // Формируем путь в Storage
    const storagePath = getStoragePath(targetUserId, category, fileName);

    // Проверяем, существует ли файл с таким именем или любое изображение профиля
    // Ищем все файлы в папке profile, чтобы удалить старые версии (например, profile.png, если загружаем profile.jpg)
    const { data: existingFiles } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(`users/${targetUserId}/${category}`, {
        limit: 100, // Получаем все файлы в папке
      });

    // Находим все файлы профиля (profile.*) для удаления старых версий
    const profileFiles = existingFiles?.filter((f) => f.name.startsWith('profile.')) || [];

    // Удаляем все старые файлы профиля (profile.*), чтобы избежать дублирования
    // ВАЖНО: удаляем ВСЕ файлы profile.*, включая тот, который собираемся загрузить
    if (profileFiles.length > 0) {
      const filesToDelete = profileFiles.map((f) => getStoragePath(targetUserId, category, f.name));

      // Удаляем все старые файлы
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .remove(filesToDelete);

      if (deleteError) {
        console.warn('Failed to delete old files (will try upsert):', {
          filesToDelete,
          error: deleteError.message,
        });
      }
    }

    // Загружаем новый файл в Supabase Storage
    // Используем upsert для гарантированной замены
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: contentType || 'image/jpeg',
        upsert: true, // Обязательно true для замены существующего файла
        cacheControl: 'no-cache', // Отключаем кеш для обновления файла
      });

    if (error) {
      console.error('Error uploading file to Supabase Storage:', {
        error: error.message,
        status: (error as any)?.status,
        name: error.name,
        storagePath,
        fileSize: fileBuffer.length,
      });
      return createErrorResponse(500, `Failed to upload file: ${error.message}`);
    }

    if (!data) {
      console.error('Upload succeeded but no data returned:', { storagePath });
      return createErrorResponse(500, 'Upload succeeded but no data returned');
    }

    // Получаем публичный URL файла сразу после загрузки
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);

    return createSuccessResponse(
      {
        url: urlData.publicUrl,
        storagePath,
      },
      200
    );
  } catch (error) {
    console.error('❌ Error in upload-file function:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString(),
    });
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
