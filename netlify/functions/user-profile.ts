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
}

interface GetUserProfileResponse {
  success: boolean;
  data?: {
    theBand: string[];
    headerImages?: string[];
    siteName?: string | null;
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

import { getUserIdFromEvent, requireAdmin } from './lib/api-helpers';

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
    // Для GET запросов используется getUserIdFromEvent (для админки)
    // Для POST требуется права админа
    const userId = event.httpMethod === 'GET' ? getUserIdFromEvent(event) : requireAdmin(event);

    if (event.httpMethod === 'GET') {
      // Если пользователь не авторизован, используем данные админа (zhoock@zhoock.ru) для публичных страниц
      let targetUserId = userId;
      if (!targetUserId) {
        console.log(
          '📡 [user-profile] GET: Пользователь не авторизован, используем данные админа для публичных страниц'
        );
        // Находим ID админа по email
        const adminResult = await query<{ id: string }>(
          `SELECT id FROM users WHERE email = 'zhoock@zhoock.ru' AND is_active = true LIMIT 1`,
          [],
          0
        );
        if (adminResult.rows.length > 0) {
          targetUserId = adminResult.rows[0].id;
          console.log('✅ [user-profile] GET: Найден ID админа:', targetUserId);
        } else {
          console.warn('⚠️ [user-profile] GET: Админ не найден в БД');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: null } as GetUserProfileResponse),
          };
        }
      }

      // Пытаемся получить данные, включая password (если поле существует)
      // Если поле password не существует, используем COALESCE для возврата NULL
      let result;
      let password = '';

      try {
        result = await query<UserProfileRow>(
          `SELECT the_band, header_images, password, site_name FROM users WHERE id = $1 AND is_active = true`,
          [targetUserId],
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
            result = await query<{ the_band: any; header_images?: any; site_name?: string | null }>(
              `SELECT the_band, header_images, site_name FROM users WHERE id = $1 AND is_active = true`,
              [targetUserId],
              0
            );
            password = '';
          } catch (innerError) {
            result = await query<{ the_band: any; site_name?: string | null }>(
              `SELECT the_band, site_name FROM users WHERE id = $1 AND is_active = true`,
              [targetUserId],
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
      const siteName = (user as any).site_name || null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { theBand, password, headerImages, siteName },
        } as GetUserProfileResponse),
      };
    }

    if (event.httpMethod === 'POST') {
      if (!userId) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Forbidden. Only admin can update user profile.',
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
