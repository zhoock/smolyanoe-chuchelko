/**
 * Netlify Function для работы с профилем пользователя
 *
 * GET /api/user-profile?lang=ru - получить описание группы (theBand) для текущего пользователя
 * POST /api/user-profile - сохранить описание группы
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { getUserIdFromEvent, requireAuth } from './lib/api-helpers';
import { PublicArtistResolverError, resolvePublicArtistUserId } from './lib/public-artist-resolver';

interface UserProfileRow {
  id: string;
  name?: string | null;
  public_slug?: string | null;
  the_band: any; // JSONB
  header_images?: any; // JSONB
  password: string | null;
  site_name?: string | null;
}

interface GetUserProfileResponse {
  success: boolean;
  data?: {
    name?: string | null;
    publicSlug?: string | null;
    theBand: string[];
    headerImages?: string[];
    siteName?: string | null;
  };
  error?: string;
}

interface SaveUserProfileRequest {
  theBand?: string[]; // Legacy: для обратной совместимости
  theBandRu?: string[]; // Новый формат: русская версия
  theBandEn?: string[]; // Новый формат: английская версия
  headerImages?: string[];
  siteName?: string;
  publicSlug?: string;
  genreCode?: string;
}

interface SaveUserProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

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
    // Для POST требуется авторизация (пользователь может обновлять свой профиль)
    const userId = event.httpMethod === 'GET' ? getUserIdFromEvent(event) : requireAuth(event);

    if (event.httpMethod === 'GET') {
      let targetUserId = userId;
      const artistSlug = event.queryStringParameters?.artist;

      // Публичный режим: если artist передан ИЛИ пользователь не авторизован
      // В этом режиме не опираемся на JWT для выбора артиста.
      if (artistSlug || !targetUserId) {
        try {
          targetUserId = await resolvePublicArtistUserId(artistSlug);
        } catch (error) {
          if (error instanceof PublicArtistResolverError) {
            return {
              statusCode: error.statusCode,
              headers,
              body: JSON.stringify({
                success: false,
                error: error.message,
              } as GetUserProfileResponse),
            };
          }
          throw error;
        }
      }

      // Пытаемся получить данные, включая password (если поле существует)
      // Если поле password не существует, используем COALESCE для возврата NULL
      let result;
      let password = '';

      try {
        result = await query<UserProfileRow>(
          `SELECT name, public_slug, the_band, header_images, password, site_name FROM users WHERE id = $1 AND is_active = true`,
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
            result = await query<{
              name?: string | null;
              public_slug?: string | null;
              the_band: any;
              header_images?: any;
              site_name?: string | null;
            }>(
              `SELECT name, public_slug, the_band, header_images, site_name FROM users WHERE id = $1 AND is_active = true`,
              [targetUserId],
              0
            );
            password = '';
          } catch (innerError) {
            result = await query<{
              name?: string | null;
              public_slug?: string | null;
              the_band: any;
              site_name?: string | null;
            }>(
              `SELECT name, public_slug, the_band, site_name FROM users WHERE id = $1 AND is_active = true`,
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

      // Получаем язык из query параметров (по умолчанию 'ru')
      const lang = (event.queryStringParameters?.lang || 'ru').toLowerCase();
      const validLang = lang === 'en' ? 'en' : 'ru';

      // Извлекаем theBand в зависимости от формата данных
      let theBand: string[] = [];
      if (user.the_band) {
        if (Array.isArray(user.the_band)) {
          // Старый формат (массив) - для обратной совместимости
          theBand = user.the_band;
        } else if (typeof user.the_band === 'object' && user.the_band !== null) {
          // Новый формат (объект с ru/en)
          const bandObj = user.the_band as { ru?: string[]; en?: string[] };
          theBand = bandObj[validLang] || bandObj.ru || bandObj.en || [];
        }
      }

      const headerImages = user.header_images
        ? Array.isArray(user.header_images)
          ? user.header_images
          : []
        : [];
      const profileName = (user as any).name || null;
      const siteName = (user as any).site_name || profileName || null;
      const publicSlug = (user as any).public_slug || null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: { name: profileName, publicSlug, theBand, password, headerImages, siteName },
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
            error: 'Unauthorized. Please provide a valid authentication token.',
          } as SaveUserProfileResponse),
        };
      }

      const data: SaveUserProfileRequest = JSON.parse(event.body || '{}');

      // Формируем список полей для обновления
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      let paramIndex = 1;

      if (data.siteName !== undefined) {
        const normalizedName = data.siteName?.trim() || null;
        // name is source of truth; keep site_name in sync for backward compatibility
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(normalizedName);
        updateFields.push(`site_name = $${paramIndex++}`);
        updateValues.push(normalizedName);
      }

      if (data.publicSlug !== undefined) {
        const normalizedSlug = data.publicSlug.trim().toLowerCase();
        const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

        if (!normalizedSlug) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'publicSlug cannot be empty',
            } as SaveUserProfileResponse),
          };
        }

        if (!slugPattern.test(normalizedSlug)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error:
                'Invalid publicSlug format. Use lowercase latin letters, numbers and hyphens only.',
            } as SaveUserProfileResponse),
          };
        }

        const slugExistsResult = await query<{ id: string }>(
          `SELECT id FROM users WHERE public_slug = $1 AND id <> $2 AND is_active = true LIMIT 1`,
          [normalizedSlug, userId],
          0
        );

        if (slugExistsResult.rows.length > 0) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'publicSlug is already in use',
            } as SaveUserProfileResponse),
          };
        }

        updateFields.push(`public_slug = $${paramIndex++}`);
        updateValues.push(normalizedSlug);
      }

      if (data.genreCode !== undefined) {
        const normalizedGenreCode = data.genreCode.trim().toLowerCase() || 'other';

        const genreExistsResult = await query<{ code: string }>(
          `SELECT code FROM genres WHERE code = $1 LIMIT 1`,
          [normalizedGenreCode],
          0
        );

        if (genreExistsResult.rows.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Invalid genreCode',
            } as SaveUserProfileResponse),
          };
        }

        updateFields.push(`genre_code = $${paramIndex++}`);
        updateValues.push(normalizedGenreCode);
      }

      // Обработка theBand: поддерживаем как старый формат (theBand), так и новый (theBandRu/theBandEn)
      if (
        data.theBandRu !== undefined ||
        data.theBandEn !== undefined ||
        data.theBand !== undefined
      ) {
        // Сначала загружаем текущие данные, чтобы сохранить обе языковые версии
        let currentBandObj: { ru?: string[]; en?: string[] } = {};

        try {
          const currentResult = await query<{ the_band: any }>(
            `SELECT the_band FROM users WHERE id = $1 AND is_active = true`,
            [userId],
            0
          );

          if (currentResult.rows.length > 0 && currentResult.rows[0].the_band) {
            const currentBand = currentResult.rows[0].the_band;
            if (Array.isArray(currentBand)) {
              // Старый формат - преобразуем в новый
              currentBandObj = { ru: currentBand, en: currentBand };
            } else if (typeof currentBand === 'object' && currentBand !== null) {
              // Уже новый формат
              currentBandObj = {
                ru: currentBand.ru || [],
                en: currentBand.en || [],
              };
            }
          }
        } catch (error) {
          console.warn('⚠️ Ошибка загрузки текущих данных the_band:', error);
        }

        // Обновляем данные в зависимости от того, что пришло
        if (data.theBandRu !== undefined) {
          if (!Array.isArray(data.theBandRu)) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Invalid request data. theBandRu must be an array of strings',
              } as SaveUserProfileResponse),
            };
          }
          currentBandObj.ru = data.theBandRu;
        }

        if (data.theBandEn !== undefined) {
          if (!Array.isArray(data.theBandEn)) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Invalid request data. theBandEn must be an array of strings',
              } as SaveUserProfileResponse),
            };
          }
          currentBandObj.en = data.theBandEn;
        }

        // Обратная совместимость: если пришел старый формат theBand, обновляем оба языка
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
          // Если не указаны явно ru/en, обновляем оба языка одинаково (для обратной совместимости)
          if (data.theBandRu === undefined && data.theBandEn === undefined) {
            currentBandObj.ru = data.theBand;
            currentBandObj.en = data.theBand;
          }
        }

        // Сохраняем обновленный объект
        updateFields.push(`the_band = $${paramIndex++}::jsonb`);
        updateValues.push(JSON.stringify(currentBandObj));
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
        theBandRuLength: data.theBandRu?.length || 0,
        theBandEnLength: data.theBandEn?.length || 0,
        theBandLength: data.theBand?.length || 0, // Legacy
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
