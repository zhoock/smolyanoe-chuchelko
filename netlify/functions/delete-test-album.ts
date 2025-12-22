/**
 * Временная функция для удаления всех данных тестового альбома "новый"
 *
 * Использование:
 * POST /api/delete-test-album
 * Authorization: Bearer <token>
 * Body: { albumId: string }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { query } from './lib/db';
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

interface DeleteTestAlbumRequest {
  albumId: string;
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
    const data = parseJsonBody<DeleteTestAlbumRequest>(event.body, {} as DeleteTestAlbumRequest);

    if (!data.albumId) {
      return createErrorResponse(400, 'Missing required field: albumId');
    }

    console.log('🗑️ DELETE TEST ALBUM - Request data:', {
      albumId: data.albumId,
      userId,
    });

    // Находим все записи альбома (все языковые версии)
    const findAlbumsResult = await query<{
      id: string;
      album_id: string;
      lang: string;
      user_id: string | null;
      cover: string | null;
    }>(
      `SELECT id, album_id, lang, user_id, cover FROM albums 
      WHERE album_id = $1`,
      [data.albumId]
    );

    if (findAlbumsResult.rows.length === 0) {
      return createErrorResponse(404, 'Album not found');
    }

    console.log('📋 Found albums to delete:', {
      count: findAlbumsResult.rows.length,
      langs: findAlbumsResult.rows.map((r) => r.lang),
      covers: findAlbumsResult.rows.map((r) => r.cover).filter(Boolean),
    });

    const albumIds = findAlbumsResult.rows.map((row) => row.id);
    const uniqueCovers = Array.from(
      new Set(
        findAlbumsResult.rows.map((row) => row.cover).filter((cover): cover is string => !!cover)
      )
    );

    // Удаляем все треки альбома
    if (albumIds.length > 0) {
      const tracksResult = await query(
        `DELETE FROM tracks WHERE album_id = ANY($1::uuid[]) RETURNING id`,
        [albumIds]
      );
      console.log('✅ Deleted tracks:', { count: tracksResult.rows.length });
    }

    // Удаляем все синхронизированные тексты альбома
    const syncedLyricsResult = await query(
      `DELETE FROM synced_lyrics 
      WHERE album_id = $1 
      RETURNING id`,
      [data.albumId]
    );
    console.log('✅ Deleted synced lyrics:', { count: syncedLyricsResult.rows.length });

    // Удаляем все языковые версии альбома
    const deleteResult = await query(
      `DELETE FROM albums 
      WHERE album_id = $1
      RETURNING id, lang, cover`,
      [data.albumId]
    );
    console.log('✅ Deleted albums:', {
      count: deleteResult.rows.length,
      langs: deleteResult.rows.map((r) => r.lang),
    });

    // Удаляем обложки из Supabase Storage
    if (uniqueCovers.length > 0) {
      const supabase = createSupabaseAdminClient();
      if (supabase) {
        const allCoverPaths: string[] = [];
        for (const coverBaseName of uniqueCovers) {
          const coverVariants = [
            `${coverBaseName}-64.webp`,
            `${coverBaseName}-128.webp`,
            `${coverBaseName}-448.webp`,
            `${coverBaseName}-896.webp`,
            `${coverBaseName}-1344.webp`,
            `${coverBaseName}-64.jpg`,
            `${coverBaseName}-128.jpg`,
            `${coverBaseName}-448.jpg`,
            `${coverBaseName}-896.jpg`,
            `${coverBaseName}-1344.jpg`,
          ];

          const coverPaths = coverVariants.map((variant) => `users/zhoock/albums/${variant}`);
          allCoverPaths.push(...coverPaths);
        }

        if (allCoverPaths.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .remove(allCoverPaths);

          if (deleteError) {
            console.warn('⚠️ Failed to delete cover files from storage:', deleteError);
          } else {
            console.log('✅ Cover files deleted from storage:', {
              coversCount: uniqueCovers.length,
              variantsCount: allCoverPaths.length,
            });
          }
        }
      }
    }

    return createSuccessResponse({
      success: true,
      message: 'Test album deleted successfully',
      deleted: {
        albums: deleteResult.rows.length,
        covers: uniqueCovers.length,
      },
    });
  } catch (error) {
    console.error('❌ Error in delete-test-album:', error);
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
};
