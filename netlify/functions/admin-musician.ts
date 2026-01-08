/**
 * Netlify Function для админ-операций с заявками музыкантов
 *
 * POST /api/admin/musician/approve - одобрить заявку
 * POST /api/admin/musician/reject - отклонить заявку
 * GET /api/admin/musician/pending - получить список заявок на рассмотрении
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import { extractUserIdFromToken } from './lib/jwt';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  parseJsonBody,
  getUserIdFromSubdomainOrEvent,
  getUserIdFromEvent,
} from './lib/api-helpers';

interface ApproveRequest {
  userId: string;
}

interface RejectRequest {
  userId: string;
  reason: string;
}

interface PendingApplication {
  id: string;
  email: string;
  name: string | null;
  artistName: string | null;
  bio: string | null;
  links: string[] | null;
  musicianAppliedAt: string | null;
}

/**
 * Проверяет, является ли пользователь админом
 */
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const result = await query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1 AND is_active = true`,
      [userId],
      0
    );

    return result.rows.length > 0 && result.rows[0].role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Для админов в dev режиме сначала проверяем токен, а не поддомен
    // Так как админ должен иметь доступ независимо от поддомена
    // Сначала пробуем получить userId из токена (из Authorization header)
    let adminUserId = getUserIdFromEvent(event);

    // Если из токена не получилось, пробуем из поддомена (для dev режима)
    if (!adminUserId) {
      adminUserId = await getUserIdFromSubdomainOrEvent(event);
    }

    console.log(`[admin-musician] Admin user ID: ${adminUserId}`);
    console.log(`[admin-musician] Event headers:`, {
      host: event.headers?.host || event.headers?.Host,
      authorization:
        event.headers?.authorization || event.headers?.Authorization ? 'present' : 'missing',
    });

    if (!adminUserId) {
      console.warn('[admin-musician] No admin user ID found');
      return createErrorResponse(401, 'Unauthorized');
    }

    // Проверяем, что пользователь - админ
    const userIsAdmin = await isAdmin(adminUserId);
    console.log(`[admin-musician] Is admin: ${userIsAdmin}`);

    if (!userIsAdmin) {
      // Получаем информацию о пользователе для диагностики
      const userInfo = await query<{ email: string; role: string }>(
        `SELECT email, role FROM users WHERE id = $1`,
        [adminUserId],
        0
      );
      console.warn(`[admin-musician] User is not admin:`, {
        userId: adminUserId,
        email: userInfo.rows[0]?.email,
        role: userInfo.rows[0]?.role,
      });
      return createErrorResponse(403, 'Forbidden: Admin access required');
    }

    const path = event.path.replace('/.netlify/functions/admin-musician', '') || '/';

    // Получить список заявок на рассмотрении
    if (event.httpMethod === 'GET' && (path === '/pending' || path.endsWith('/pending'))) {
      console.log(`[admin-musician] Fetching pending applications for admin: ${adminUserId}`);

      // Сначала проверим, сколько всего заявок со статусом pending
      const checkResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE musician_status = 'pending' AND is_active = true`,
        [],
        0
      );
      console.log(
        `[admin-musician] Total pending applications in DB (active only): ${checkResult.rows[0]?.count || 0}`
      );

      // Проверим все заявки со статусом pending (включая неактивные) для диагностики
      const allPendingCheck = await query<{
        id: string;
        email: string;
        musician_status: string;
        is_active: boolean;
        musician_applied_at: Date | null;
      }>(
        `SELECT id, email, musician_status, is_active, musician_applied_at 
         FROM users 
         WHERE musician_status = 'pending'`,
        [],
        0
      );
      console.log(
        `[admin-musician] All pending applications (including inactive):`,
        allPendingCheck.rows.map((r) => ({
          id: r.id,
          email: r.email,
          status: r.musician_status,
          isActive: r.is_active,
          appliedAt: r.musician_applied_at,
        }))
      );

      const result = await query<{
        id: string;
        email: string;
        name: string | null;
        artistName: string | null;
        bio: string | null;
        links: unknown; // JSONB, будет преобразован ниже
        musicianAppliedAt: string | null;
      }>(
        `SELECT 
          id,
          email,
          name,
          artist_name as "artistName",
          bio,
          links,
          musician_applied_at as "musicianAppliedAt"
        FROM users
        WHERE musician_status = 'pending' 
          AND is_active = true
        ORDER BY musician_applied_at ASC`,
        [],
        0
      );

      // Преобразуем JSONB links в массив строк
      const applications: PendingApplication[] = result.rows.map((row) => {
        let linksArray: string[] = [];

        if (row.links) {
          if (Array.isArray(row.links)) {
            linksArray = row.links.filter((link): link is string => typeof link === 'string');
          } else if (typeof row.links === 'string') {
            try {
              const parsed = JSON.parse(row.links);
              if (Array.isArray(parsed)) {
                linksArray = parsed.filter((link): link is string => typeof link === 'string');
              }
            } catch (e) {
              console.warn('[admin-musician] Failed to parse links as JSON:', e);
            }
          }
        }

        return {
          id: row.id,
          email: row.email,
          name: row.name,
          artistName: row.artistName,
          bio: row.bio,
          links: linksArray,
          musicianAppliedAt: row.musicianAppliedAt,
        };
      });

      console.log(
        `[admin-musician] Found ${applications.length} pending applications:`,
        applications.map((r) => ({ id: r.id, email: r.email, artistName: r.artistName }))
      );

      return createSuccessResponse(applications);
    }

    // Одобрить заявку
    if (event.httpMethod === 'POST' && (path === '/approve' || path.endsWith('/approve'))) {
      const data = parseJsonBody<ApproveRequest>(event.body, {} as ApproveRequest);

      if (!data.userId) {
        return createErrorResponse(400, 'userId is required');
      }

      // Обновляем роль и статус
      await query(
        `UPDATE users 
         SET role = 'musician',
             musician_status = 'approved',
             musician_approved_at = NOW(),
             musician_reject_reason = NULL,
             updated_at = NOW()
         WHERE id = $1 
           AND musician_status = 'pending'
           AND is_active = true`,
        [data.userId],
        0
      );

      return createSuccessResponse({
        success: true,
        message: 'Application approved successfully',
      });
    }

    // Отклонить заявку
    if (event.httpMethod === 'POST' && (path === '/reject' || path.endsWith('/reject'))) {
      const data = parseJsonBody<RejectRequest>(event.body, {} as RejectRequest);

      if (!data.userId) {
        return createErrorResponse(400, 'userId is required');
      }

      if (!data.reason || data.reason.trim().length === 0) {
        return createErrorResponse(400, 'reason is required');
      }

      // Обновляем статус и причину отклонения
      await query(
        `UPDATE users 
         SET musician_status = 'rejected',
             musician_reject_reason = $1,
             updated_at = NOW()
         WHERE id = $2 
           AND musician_status = 'pending'
           AND is_active = true`,
        [data.reason.trim(), data.userId],
        0
      );

      return createSuccessResponse({
        success: true,
        message: 'Application rejected successfully',
      });
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    console.error('Error in admin-musician:', error);
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
