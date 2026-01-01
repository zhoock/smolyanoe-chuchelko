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
}

interface GetUserProfileResponse {
  success: boolean;
  data?: {
    theBand: string[];
    headerImages?: string[];
  };
  error?: string;
}

interface SaveUserProfileRequest {
  theBand: string[];
  headerImages?: string[];
}

interface SaveUserProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

import { extractUserIdFromToken } from './lib/jwt';

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
    const userId = extractUserIdFromToken(event.headers.authorization);

    if (event.httpMethod === 'GET') {
      if (!userId) {
        // Если пользователь не авторизован, возвращаем null (будет использован JSON fallback)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, data: null } as GetUserProfileResponse),
        };
      }

      // Пытаемся получить данные, включая password (если поле существует)
      // Если поле password не существует, используем COALESCE для возврата NULL
      let result;
      let password = '';

      try {
        result = await query<UserProfileRow>(
          `SELECT the_band, header_images, password FROM users WHERE id = $1 AND is_active = true`,
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
            result = await query<{ the_band: any; header_images?: any }>(
              `SELECT the_band, header_images FROM users WHERE id = $1 AND is_active = true`,
              [userId],
              0
            );
            password = '';
          } catch (innerError) {
            result = await query<{ the_band: any }>(
              `SELECT the_band FROM users WHERE id = $1 AND is_active = true`,
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
      const theBand = user.the_band ? (Array.isArray(user.the_band) ? user.the_band : []) : [];
      const headerImages = user.header_images
        ? Array.isArray(user.header_images)
          ? user.header_images
          : []
        : [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { theBand, password, headerImages },
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

      if (!data.theBand || !Array.isArray(data.theBand)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid request data. Required: theBand (array of strings)',
          } as SaveUserProfileResponse),
        };
      }

      // Обновляем the_band и header_images (если указаны)
      if (data.headerImages !== undefined) {
        await query(
          `UPDATE users 
           SET the_band = $1::jsonb, 
               header_images = $2::jsonb, 
               updated_at = NOW()
           WHERE id = $3 AND is_active = true`,
          [JSON.stringify(data.theBand), JSON.stringify(data.headerImages || []), userId],
          0
        );
      } else {
        await query(
          `UPDATE users 
           SET the_band = $1::jsonb, updated_at = NOW()
           WHERE id = $2 AND is_active = true`,
          [JSON.stringify(data.theBand), userId],
          0
        );
      }

      console.log('✅ User profile updated:', {
        userId,
        theBandLength: data.theBand.length,
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
