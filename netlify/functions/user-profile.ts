/**
 * Netlify Function для работы с профилем пользователя
 *
 * GET /api/user-profile?lang=ru - получить описание группы (theBand) для текущего пользователя
 * POST /api/user-profile - сохранить описание группы
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';

interface UserProfileRow {
  id: string;
  the_band: any; // JSONB
  header_images?: any; // JSONB
  password: string | null;
  site_name?: string | null;
  role?: string;
  musician_status?: string;
  musician_reject_reason?: string | null;
  musician_applied_at?: Date | null;
  musician_approved_at?: Date | null;
  artist_name?: string | null;
  bio?: string | null;
  links?: any; // JSONB
}

interface GetUserProfileResponse {
  success: boolean;
  data?: {
    userId: string;
    username: string;
    theBand: string[];
    headerImages?: string[];
    siteName?: string | null;
    role?: string;
    musicianStatus?: string;
    musicianRejectReason?: string | null;
    musicianAppliedAt?: string | null;
    musicianApprovedAt?: string | null;
    artistName?: string | null;
    bio?: string | null;
    links?: string[];
    password?: string;
  };
  error?: string;
}

interface SaveUserProfileRequest {
  theBand?: string[];
  headerImages?: string[];
  siteName?: string;
}

interface SaveUserProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

import { extractUserIdFromToken } from './lib/jwt';
import {
  getUserIdFromEvent,
  getUsernameFromEvent,
  getUserIdFromUsernameOrEvent,
} from './lib/api-helpers';
import { getUserByUsername } from './lib/username-helpers';

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const requestedUsername = getUsernameFromEvent(event);
    let userId: string | null = null;
    let resolvedUsername: string | null = null;

    if (event.httpMethod === 'GET') {
      if (requestedUsername) {
        const userRecord = await getUserByUsername(requestedUsername);
        if (!userRecord) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'User not found' }),
          };
        }
        userId = userRecord.id;
        resolvedUsername = userRecord.username;
      } else {
        userId = getUserIdFromEvent(event);
        if (!userId) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'User not found' }),
          };
        }
      }
    } else {
      userId = getUserIdFromEvent(event);
    }

    if (event.httpMethod === 'GET') {
      if (!userId) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'User not found' }),
        };
      }

      // Пытаемся получить данные, включая password (если поле существует)
      // Если поле password не существует, используем COALESCE для возврата NULL
      let result;
      let password = '';

      try {
        result = await query<UserProfileRow>(
          `SELECT 
            username,
            the_band, 
            header_images, 
            password, 
            site_name,
            role,
            musician_status,
            musician_reject_reason,
            musician_applied_at,
            musician_approved_at,
            artist_name,
            bio,
            links
          FROM users 
          WHERE id = $1 AND is_active = true`,
          [userId],
          0
        );

        if (result.rows.length > 0) {
          password = result.rows[0].password || '';
        }
      } catch (error: any) {
        // Если ошибка связана с отсутствием колонки, пробуем без неё
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('column')) {
          console.log('⚠️ Некоторые поля еще не существуют в БД, используем только доступные');
          try {
            result = await query<UserProfileRow>(
              `SELECT 
                username,
                the_band, 
                header_images, 
                site_name,
                role,
                musician_status
              FROM users 
              WHERE id = $1 AND is_active = true`,
              [userId],
              0
            );
            password = '';
          } catch (innerError) {
            result = await query<{ username: string; the_band: any; site_name?: string | null }>(
              `SELECT username, the_band, site_name FROM users WHERE id = $1 AND is_active = true`,
              [userId],
              0
            );
            password = '';
          }
        } else {
          throw error; // Перебрасываем другую ошибку
        }
      }

      if (!result || result.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User not found',
          } as GetUserProfileResponse),
        };
      }

      const user = result.rows[0];
      const usernameFromDb = (user as any).username || null;
      if (!resolvedUsername && usernameFromDb) {
        resolvedUsername = usernameFromDb;
      }
      const theBand = user.the_band ? (Array.isArray(user.the_band) ? user.the_band : []) : [];
      const headerImages = user.header_images
        ? Array.isArray(user.header_images)
          ? user.header_images
          : []
        : [];
      const siteName = (user as any).site_name || null;

      // Парсим links из JSONB
      let links: string[] = [];
      if (user.links) {
        try {
          links = Array.isArray(user.links) ? user.links : JSON.parse(user.links as any);
        } catch (e) {
          links = [];
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            userId,
            username: resolvedUsername || usernameFromDb || '',
            password,
            theBand,
            headerImages,
            siteName,
            role: user.role || 'user',
            musicianStatus: user.musician_status || 'none',
            musicianRejectReason: user.musician_reject_reason || null,
            musicianAppliedAt: user.musician_applied_at
              ? user.musician_applied_at.toISOString()
              : null,
            musicianApprovedAt: user.musician_approved_at
              ? user.musician_approved_at.toISOString()
              : null,
            artistName: user.artist_name || null,
            bio: user.bio || null,
            links,
          },
        } as GetUserProfileResponse),
      };
    }

    if (event.httpMethod === 'POST') {
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Unauthorized',
          } as SaveUserProfileResponse),
        };
      }

      const data: SaveUserProfileRequest = JSON.parse(event.body || '{}');

      // Формируем список полей для обновления
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      let paramIndex = 1;

      if (data.siteName !== undefined) {
        updateFields.push(`site_name = $${paramIndex++}`);
        updateValues.push(data.siteName || null);
      }

      if (data.theBand !== undefined) {
        if (!Array.isArray(data.theBand)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Invalid request data. theBand must be an array of strings',
            } as SaveUserProfileResponse),
          };
        }
        updateFields.push(`the_band = $${paramIndex++}::jsonb`);
        updateValues.push(JSON.stringify(data.theBand));
      }

      if (data.headerImages !== undefined) {
        updateFields.push(`header_images = $${paramIndex++}::jsonb`);
        updateValues.push(JSON.stringify(data.headerImages || []));
      }

      if (updateFields.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'No fields to update',
          } as SaveUserProfileResponse),
        };
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(userId);

      // Обновляем указанные поля
      await query(
        `UPDATE users 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex} AND is_active = true`,
        updateValues,
        0
      );

      console.log('✅ User profile updated:', {
        userId,
        siteName: data.siteName,
        theBandLength: data.theBand?.length || 0,
        headerImagesLength: data.headerImages?.length || 0,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'User profile updated successfully',
        } as SaveUserProfileResponse),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('❌ Error in user-profile function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
