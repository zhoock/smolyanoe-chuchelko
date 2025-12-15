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
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey =
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Supabase credentials not found:', {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      envKeys: Object.keys(process.env).filter((k) => k.includes('SUPABASE')),
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
  // Логируем начало выполнения функции
  console.log('🚀 upload-file function called:', {
    method: event.httpMethod,
    path: event.path,
    queryString: event.queryStringParameters,
    hasBody: !!event.body,
    bodyLength: event.body?.length || 0,
    timestamp: new Date().toISOString(),
  });

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    console.log('✅ CORS preflight request');
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    console.error('❌ Invalid method:', event.httpMethod);
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Проверяем авторизацию
    const userId = requireAuth(event);
    console.log('🔐 Auth check:', { userId, hasAuth: !!userId });
    if (!userId) {
      console.error('❌ Unauthorized request');
      return createErrorResponse(401, 'Unauthorized. Please provide a valid token.');
    }

    // Парсим JSON body
    const body = parseJsonBody<Partial<UploadFileRequest>>(event.body, {});

    const { fileBase64, fileName, category, contentType, originalFileSize, originalFileName } =
      body;

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
      console.warn('⚠️ File size mismatch:', {
        originalFileSize,
        receivedSize,
        difference: Math.abs(receivedSize - originalFileSize),
      });
    }

    console.log('📦 File received:', {
      originalFileName,
      fileName,
      originalFileSize,
      receivedSize,
      base64Length: fileBase64.length,
      bufferSize: fileBuffer.length,
      contentType,
    });

    // Формируем путь в Storage
    const storagePath = getStoragePath(targetUserId, category, fileName);

    // Проверяем, существует ли файл с таким именем или любое изображение профиля
    // Ищем все файлы в папке profile, чтобы удалить старые версии (например, profile.png, если загружаем profile.jpg)
    const { data: existingFiles } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(`${targetUserId}/${category}`, {
        limit: 100, // Получаем все файлы в папке
      });

    // Проверяем, существует ли файл с таким же именем
    const fileExists = existingFiles && existingFiles.some((f) => f.name === fileName);

    // Находим все файлы профиля (profile.*) для удаления старых версий
    const profileFiles = existingFiles?.filter((f) => f.name.startsWith('profile.')) || [];

    // Удаляем все старые файлы профиля (profile.*), чтобы избежать дублирования
    // ВАЖНО: удаляем ВСЕ файлы profile.*, включая тот, который собираемся загрузить
    if (profileFiles.length > 0) {
      const filesToDelete = profileFiles.map((f) => getStoragePath(targetUserId, category, f.name));

      console.log('📋 Found existing profile files, will be replaced:', {
        files: profileFiles.map((f) => f.name),
        filesToDelete,
        newFileName: fileName,
      });

      // Удаляем все старые файлы
      const { error: deleteError, data: deleteData } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .remove(filesToDelete);

      if (deleteError) {
        console.warn('⚠️ Failed to delete old files (will try upsert):', {
          filesToDelete,
          error: deleteError.message,
        });
      } else {
        console.log('✅ Old profile files deleted successfully:', {
          deletedFiles: deleteData,
          count: filesToDelete.length,
        });

        // Увеличиваем задержку для синхронизации Storage (1 секунда)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Проверяем, что файлы действительно удалены
        const { data: verifyDeleted } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .list(`${targetUserId}/${category}`, {
            limit: 100,
          });

        const remainingFiles = verifyDeleted?.filter((f) => f.name.startsWith('profile.')) || [];
        if (remainingFiles.length > 0) {
          console.warn('⚠️ Some profile files still exist after deletion:', {
            remainingFiles: remainingFiles.map((f) => f.name),
          });
          // Пытаемся удалить ещё раз
          const remainingPaths = remainingFiles.map((f) =>
            getStoragePath(targetUserId, category, f.name)
          );
          await supabase.storage.from(STORAGE_BUCKET_NAME).remove(remainingPaths);
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          console.log('✅ All profile files successfully deleted');
        }
      }
    } else {
      console.log('📋 No existing profile files found, will create new:', storagePath);
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

    console.log('📤 Upload response:', {
      storagePath,
      uploadData: data,
      path: data.path,
      id: data.id,
      fullPath: data.fullPath,
      uploadedSize: fileBuffer.length,
      originalFileSize,
    });

    // Проверяем, что файл действительно загружен (с задержкой для синхронизации)
    // Делаем несколько попыток с задержками
    let verifyData: any = null;
    let verifyError: any = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Увеличиваем задержку с каждой попыткой

      const { data: listData, error: listError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .list(`${targetUserId}/${category}`, {
          limit: 100,
        });

      if (listError) {
        console.warn(`Attempt ${attempt}: Could not list files:`, listError.message);
        verifyError = listError;
        continue;
      }

      const foundFile = listData?.find((file) => file.name === fileName);
      if (foundFile) {
        verifyData = foundFile;
        const fileSize = foundFile.metadata?.size || 0;
        const sizeMatch = originalFileSize ? Math.abs(fileSize - originalFileSize) < 100 : true;

        console.log(`✅ File verified in storage (attempt ${attempt}):`, {
          fileName: foundFile.name,
          size: fileSize,
          originalFileSize,
          sizeMatch,
          updated: foundFile.updated_at,
          created: foundFile.created_at,
        });

        if (!sizeMatch && originalFileSize) {
          console.warn('⚠️ File size mismatch in storage!', {
            expected: originalFileSize,
            actual: fileSize,
            difference: Math.abs(fileSize - originalFileSize),
          });
        }
        break;
      } else {
        console.warn(`Attempt ${attempt}: File not found in list:`, {
          storagePath,
          fileName,
          listedFiles: listData?.map((f) => f.name),
        });
      }
    }

    // Также пытаемся получить файл напрямую по пути
    const { data: directFile, error: directError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .download(storagePath);

    if (directError) {
      console.warn(
        '⚠️ Could not download file directly (may be normal if file is large):',
        directError.message
      );
    } else if (directFile) {
      console.log('✅ File can be downloaded directly, size:', directFile.size, 'bytes');
    }

    console.log('📋 Final upload summary:', {
      storagePath,
      publicUrl: urlData.publicUrl,
      uploadData: data,
      verified: !!verifyData,
      canDownload: !!directFile,
      fileSize: fileBuffer.length,
    });

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
