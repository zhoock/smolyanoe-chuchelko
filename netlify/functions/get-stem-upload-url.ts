/**
 * Netlify Function для получения signed URL для загрузки стемов
 *
 * Использование:
 * POST /api/stems/upload-url
 * Authorization: Bearer <token>
 * Body: { albumId: string, trackId: string, fileName: string }
 *
 * Возвращает:
 * {
 *   success: true,
 *   data: {
 *     signedUrl: string,
 *     storagePath: string,
 *     authUserId: string
 *   }
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

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase credentials not found');
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

interface GetStemUploadUrlRequest {
  albumId: string;
  trackId: string;
  fileName: string;
}

interface GetStemUploadUrlResponse {
  success: boolean;
  data?: {
    signedUrl: string;
    storagePath: string;
    authUserId: string;
  };
  error?: string;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
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
    const body = parseJsonBody<Partial<GetStemUploadUrlRequest>>(event.body, {});

    const { albumId, trackId, fileName } = body;

    if (!albumId || !trackId || !fileName) {
      return createErrorResponse(400, 'Missing required fields: albumId, trackId, fileName');
    }

    // Используем UUID пользователя из токена
    const storageUserId = userId;

    // Формируем путь в Storage: users/zhoock/audio/{albumId}/{trackId}/{fileName}
    const storagePath = `users/${storageUserId}/audio/${albumId}/${trackId}/${fileName}`;

    console.log('🔐 [get-stem-upload-url] Generating signed URL:', {
      albumId,
      trackId,
      fileName,
      storagePath,
    });

    // Создаём Supabase клиент с service role key
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse(500, 'Failed to create Supabase client');
    }

    // Генерируем signed URL для загрузки (действителен 1 час)
    console.log('🔄 [get-stem-upload-url] Creating signed upload URL...', {
      bucket: STORAGE_BUCKET_NAME,
      storagePath,
    });

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .createSignedUploadUrl(storagePath, {
        upsert: true,
      });

    if (signedUrlError || !signedUrlData) {
      console.error('❌ [get-stem-upload-url] Failed to create signed URL:', {
        error: signedUrlError,
        errorMessage: signedUrlError?.message,
        errorStatus: (signedUrlError as any)?.status,
        errorName: signedUrlError?.name,
        storagePath,
      });
      return createErrorResponse(
        500,
        signedUrlError?.message || 'Failed to create signed upload URL'
      );
    }

    console.log('✅ [get-stem-upload-url] Signed URL created successfully', {
      hasSignedUrl: !!signedUrlData.signedUrl,
      signedUrlPrefix: signedUrlData.signedUrl?.substring(0, 100) || 'N/A',
      storagePath,
    });

    return createSuccessResponse(
      {
        signedUrl: signedUrlData.signedUrl,
        storagePath,
        authUserId: storageUserId,
      },
      200
    );
  } catch (error) {
    console.error('❌ [get-stem-upload-url] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
