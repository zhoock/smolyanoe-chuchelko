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
import { generateHeroImageVariants, extractBaseName } from './lib/image-processor';

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
  // В Netlify Functions переменные с префиксом VITE_ недоступны
  // Используем переменные без префикса для серверных функций
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  // Используем UUID пользователя для всех категорий
  // Это обеспечивает правильную изоляцию данных для мультипользовательской системы
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
    console.log('🔄 [upload-file] Декодирование base64...', {
      base64Length: fileBase64.length,
      category,
      fileName,
      originalFileSize,
    });
    const startDecode = Date.now();
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const decodeTime = Date.now() - startDecode;

    // Проверяем размер файла
    const receivedSize = fileBuffer.length;
    console.log(
      `✅ [upload-file] Декодирование завершено за ${decodeTime}ms, размер буфера: ${receivedSize} байт`
    );
    if (originalFileSize && Math.abs(receivedSize - originalFileSize) > 100) {
      console.warn('File size mismatch:', {
        originalFileSize,
        receivedSize,
        difference: Math.abs(receivedSize - originalFileSize),
      });
    }

    // Для категории hero генерируем варианты изображений
    if (category === 'hero') {
      // Используем UUID пользователя из токена
      const heroUserId = userId;

      // Извлекаем базовое имя файла (без расширения)
      const baseName = extractBaseName(fileName);

      console.log('🖼️ Generating hero image variants for:', baseName);
      const variants = await generateHeroImageVariants(fileBuffer, baseName);

      // Удаляем старые варианты этого изображения (если есть)
      const heroFolder = `users/${heroUserId}/hero`;
      const { data: existingFiles } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .list(heroFolder, {
          limit: 100,
        });

      if (existingFiles && existingFiles.length > 0) {
        // Находим все файлы с таким же базовым именем
        const oldFiles = existingFiles
          .filter((f) => {
            const fileBaseName = extractBaseName(f.name);
            return fileBaseName === baseName;
          })
          .map((f) => `${heroFolder}/${f.name}`);

        if (oldFiles.length > 0) {
          console.log(`🗑️ Removing ${oldFiles.length} old hero image variants`);
          await supabase.storage.from(STORAGE_BUCKET_NAME).remove(oldFiles);
        }
      }

      // Загружаем все варианты
      const uploadedFiles: string[] = [];
      const uploadErrors: string[] = [];

      for (const [variantFileName, buffer] of Object.entries(variants)) {
        const variantPath = getStoragePath(heroUserId, category, variantFileName);
        const variantContentType = variantFileName.endsWith('.avif')
          ? 'image/avif'
          : variantFileName.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';

        const { data: variantData, error: variantError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(variantPath, buffer, {
            contentType: variantContentType,
            upsert: true,
            cacheControl: '3600', // Кеш на 1 час
          });

        if (variantError) {
          console.error(`Error uploading variant ${variantFileName}:`, variantError.message);
          uploadErrors.push(`${variantFileName}: ${variantError.message}`);
        } else {
          uploadedFiles.push(variantFileName);
        }
      }

      if (uploadErrors.length > 0) {
        console.error('Some hero image variants failed to upload:', uploadErrors);
        if (uploadedFiles.length === 0) {
          return createErrorResponse(
            500,
            `Failed to upload any hero image variants: ${uploadErrors.join(', ')}`
          );
        }
      }

      console.log(`✅ Uploaded ${uploadedFiles.length} hero image variants`);

      // Используем -1920.jpg как основной файл (Full HD версия)
      const mainFileName = `${baseName}-1920.jpg`;
      const mainPath = getStoragePath(heroUserId, category, mainFileName);

      // Для hero изображений возвращаем storagePath, клиент сформирует URL через getStorageFileUrl
      // Это более надежно, чем формировать URL на сервере
      console.log('📤 [upload-file] Hero image upload success:', {
        mainPath,
        baseName,
        heroUserId,
        category,
      });

      // Генерируем proxy URL на клиенте через getStorageFileUrl
      // Возвращаем storagePath, который клиент использует для генерации URL
      return createSuccessResponse(
        {
          url: mainPath, // Возвращаем storagePath, клиент сформирует proxy URL
          storagePath: mainPath,
          baseName,
        },
        200
      );
    }

    // Для остальных категорий загружаем файл как есть
    // Формируем путь в Storage
    // Используем UUID пользователя из токена для всех категорий
    const audioUserId = targetUserId;
    const storagePath = getStoragePath(audioUserId, category, fileName);

    // Для категории profile удаляем старые файлы профиля
    if (category === 'profile') {
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
        const filesToDelete = profileFiles.map((f) =>
          getStoragePath(targetUserId, category, f.name)
        );

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
    }

    // Загружаем новый файл в Supabase Storage
    // Используем upsert для гарантированной замены
    const defaultContentType =
      category === 'audio' ? 'audio/wav' : category === 'stems' ? 'image/jpeg' : 'image/jpeg';
    const finalContentType = contentType || defaultContentType;

    console.log('📤 [upload-file] Uploading file:', {
      category,
      storagePath,
      fileSize: fileBuffer.length,
      contentType: finalContentType,
      targetUserId: targetUserId,
    });

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: finalContentType,
        upsert: true, // Обязательно true для замены существующего файла
        cacheControl: category === 'audio' ? '3600' : 'no-cache', // Для audio кеш на 1 час
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
