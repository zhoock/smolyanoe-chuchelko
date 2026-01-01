/**
 * Netlify Serverless Function для удаления hero изображения и всех его вариантов из Supabase Storage
 *
 * Использование:
 * DELETE /api/delete-hero-image
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * Body: {
 *   imageUrl: string (URL изображения, например https://.../hero-123-1920.jpg или image-set(...))
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  parseJsonBody,
} from './lib/api-helpers';
import { extractBaseName } from './lib/image-processor';

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
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

interface DeleteHeroImageRequest {
  imageUrl: string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'DELETE') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Проверяем авторизацию
    const userId = requireAuth(event);
    if (!userId) {
      return createErrorResponse(401, 'Unauthorized. Please provide a valid token.');
    }

    // Парсим JSON body
    const body = parseJsonBody<DeleteHeroImageRequest>(event.body, {});

    if (!body.imageUrl) {
      return createErrorResponse(400, 'Missing required field: imageUrl');
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse(500, 'Failed to initialize Supabase client');
    }

    // Извлекаем базовое имя файла из URL
    // URL может быть:
    // 1. Полный URL: https://.../users/.../hero/hero-123-1920.jpg
    // 2. image-set() строка: image-set(url('.../hero-123-1920.jpg') ...)
    // 3. Простой путь: /images/hero/2.jpg
    let fileName = '';
    if (body.imageUrl.includes('image-set')) {
      // Извлекаем первый URL из image-set()
      const urlMatch = body.imageUrl.match(/url\(['"]([^'"]+)['"]\)/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        // Извлекаем имя файла из URL
        fileName = url.includes('/') ? url.split('/').pop() || '' : url;
      } else {
        return createErrorResponse(400, 'Invalid image-set() format');
      }
    } else if (body.imageUrl.includes('/')) {
      // Извлекаем имя файла из полного URL или пути
      fileName = body.imageUrl.split('/').pop() || '';
    } else {
      fileName = body.imageUrl;
    }

    if (!fileName) {
      return createErrorResponse(400, 'Could not extract file name from imageUrl');
    }

    // Извлекаем базовое имя (без расширения и суффиксов размеров)
    const baseName = extractBaseName(fileName);
    console.log('🗑️ Deleting hero image variants for base name:', baseName);

    // Находим все варианты этого изображения в Storage
    const heroFolder = `users/${userId}/hero`;
    const { data: existingFiles, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(heroFolder, {
        limit: 100,
      });

    if (listError) {
      console.error('Error listing hero files:', listError);
      return createErrorResponse(500, `Failed to list files: ${listError.message}`);
    }

    if (!existingFiles || existingFiles.length === 0) {
      console.log('No files found in hero folder');
      return createSuccessResponse(
        {
          success: true,
          message: 'No files to delete',
          deletedCount: 0,
        },
        200
      );
    }

    // Находим все файлы с таким же базовым именем
    const filesToDelete = existingFiles
      .filter((f) => {
        const fileBaseName = extractBaseName(f.name);
        return fileBaseName === baseName;
      })
      .map((f) => `${heroFolder}/${f.name}`);

    if (filesToDelete.length === 0) {
      console.log('No variants found for base name:', baseName);
      return createSuccessResponse(
        {
          success: true,
          message: 'No variants found to delete',
          deletedCount: 0,
        },
        200
      );
    }

    console.log(`🗑️ Deleting ${filesToDelete.length} hero image variants:`, filesToDelete);

    // Удаляем все варианты
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .remove(filesToDelete);

    if (deleteError) {
      console.error('Error deleting hero image variants:', deleteError);
      return createErrorResponse(500, `Failed to delete files: ${deleteError.message}`);
    }

    console.log(`✅ Successfully deleted ${filesToDelete.length} hero image variants`);

    return createSuccessResponse(
      {
        success: true,
        message: 'Hero image variants deleted successfully',
        deletedCount: filesToDelete.length,
        baseName,
      },
      200
    );
  } catch (error) {
    console.error('❌ Error in delete-hero-image:', error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
};
