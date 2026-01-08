/**
 * Netlify Function для подачи заявки на статус музыканта
 *
 * POST /api/musician/apply - подать заявку на статус музыканта
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  parseJsonBody,
  getUserIdFromSubdomainOrEvent,
} from './lib/api-helpers';

interface MusicianApplyRequest {
  artistName: string;
  bio?: string;
  links?: string[];
}

interface MusicianApplyResponse {
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Проверяем авторизацию с поддержкой поддоменов в dev режиме
    const userId = await getUserIdFromSubdomainOrEvent(event);
    if (!userId) {
      return createErrorResponse(401, 'Unauthorized');
    }

    // Парсим тело запроса
    const data = parseJsonBody<MusicianApplyRequest>(event.body, {} as MusicianApplyRequest);

    // Валидация
    if (!data.artistName || data.artistName.trim().length === 0) {
      return createErrorResponse(400, 'artistName is required');
    }

    // Проверяем текущий статус пользователя
    const userResult = await query<{
      role: string;
      musician_status: string;
    }>(`SELECT role, musician_status FROM users WHERE id = $1 AND is_active = true`, [userId], 0);

    if (userResult.rows.length === 0) {
      return createErrorResponse(404, 'User not found');
    }

    const user = userResult.rows[0];

    // Проверяем, может ли пользователь подать заявку
    if (user.musician_status === 'pending') {
      return createErrorResponse(400, 'Application already pending');
    }

    if (user.musician_status === 'approved' && user.role === 'musician') {
      return createErrorResponse(400, 'User is already an approved musician');
    }

    // Обновляем статус и данные заявки
    // Пользователь может менять только musician_status с 'none' или 'rejected' на 'pending'
    const linksJson = JSON.stringify(data.links || []);

    await query(
      `UPDATE users 
       SET musician_status = 'pending',
           musician_applied_at = NOW(),
           artist_name = $1,
           bio = $2,
           links = $3::jsonb,
           musician_reject_reason = NULL,
           updated_at = NOW()
       WHERE id = $4 
         AND is_active = true
         AND (musician_status = 'none' OR musician_status = 'rejected')`,
      [data.artistName.trim(), data.bio?.trim() || null, linksJson, userId],
      0
    );

    return createSuccessResponse<MusicianApplyResponse>({
      success: true,
      message: 'Application submitted successfully',
    });
  } catch (error) {
    console.error('Error in musician-apply:', error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
