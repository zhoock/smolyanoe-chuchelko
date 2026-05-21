/**
 * Netlify Function для смены пароля пользователя
 *
 * POST /api/change-password - смена пароля для текущего пользователя
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import * as bcrypt from 'bcryptjs';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  getUserIdFromEvent,
  unauthorizedFromAuthHeader,
  parseJsonBody,
  handleError,
} from './lib/api-helpers';
import type { ApiResponse } from './lib/types';

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface ChangePasswordResponse extends ApiResponse<{ message: string }> {}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
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
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    const userId = getUserIdFromEvent(event);

    if (!userId) {
      return unauthorizedFromAuthHeader(event);
    }

    const data = parseJsonBody<ChangePasswordRequest>(event.body, {} as ChangePasswordRequest);

    if (!data.currentPassword || !data.newPassword) {
      return createErrorResponse(400, 'Current password and new password are required');
    }

    // Валидация нового пароля
    if (data.newPassword.length < 8) {
      return createErrorResponse(400, 'New password must be at least 8 characters long');
    }

    if (data.newPassword === data.currentPassword) {
      return createErrorResponse(400, 'New password must be different from current password');
    }

    // Получаем пользователя из БД
    const result = await query<UserRow>(
      `SELECT id, email, password_hash, is_active
       FROM users
       WHERE id = $1`,
      [userId],
      0
    );

    if (result.rows.length === 0) {
      return createErrorResponse(404, 'User not found');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return createErrorResponse(403, 'User account is disabled');
    }

    // Проверяем текущий пароль
    console.log('🔍 Checking current password for user:', userId);
    const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password_hash);

    if (!isPasswordValid) {
      console.log('❌ Invalid current password for user:', userId);
      return createErrorResponse(401, 'Invalid current password', headers, {
        code: 'INVALID_CREDENTIALS',
      });
    }

    console.log('✅ Current password is valid, hashing new password...');
    // Хешируем новый пароль
    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

    // Обновляем пароль в БД (и password_hash, и password в открытом виде для админки)
    console.log('💾 Updating password_hash and password in database...');
    console.log('📝 New password (plaintext):', data.newPassword);

    try {
      // Обновляем пароль в БД (сначала password_hash, потом password отдельно для надежности)
      const updateResult = await query(
        `UPDATE users 
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2 AND is_active = true`,
        [newPasswordHash, userId],
        0
      );

      console.log('✅ password_hash updated, rows affected:', updateResult.rowCount);

      // Обновляем password отдельным запросом
      try {
        const passwordUpdateResult = await query(
          `UPDATE users 
           SET password = $1, updated_at = NOW()
           WHERE id = $2 AND is_active = true`,
          [data.newPassword, userId],
          0
        );
        console.log(
          '✅ password (plaintext) updated, rows affected:',
          passwordUpdateResult.rowCount
        );
      } catch (passwordUpdateError: any) {
        console.error('⚠️ Error updating password field:', passwordUpdateError);
        // Не бросаем ошибку, если поле password не существует или есть другая проблема
        // Главное - password_hash обновлен, пользователь сможет войти
      }

      console.log(
        '✅ Password updated successfully for user:',
        userId,
        'Rows affected:',
        updateResult.rowCount
      );

      // Проверяем, что пароль действительно обновился
      const verifyResult = await query<{ password: string }>(
        `SELECT password FROM users WHERE id = $1`,
        [userId],
        0
      );

      if (verifyResult.rows.length > 0) {
        const dbPassword = verifyResult.rows[0].password;
        console.log(
          '🔍 Verified password in DB:',
          dbPassword === data.newPassword ? 'MATCHES' : 'DOES NOT MATCH'
        );
        console.log('🔍 DB password value:', dbPassword ? `"${dbPassword}"` : 'NULL');
        console.log('🔍 Expected password:', `"${data.newPassword}"`);
        if (dbPassword !== data.newPassword) {
          console.error('❌ Password in DB does not match new password!');
          // Пробуем обновить еще раз, возможно была ошибка
          console.log('🔄 Retrying password update...');
          await query(
            `UPDATE users 
             SET password = $1, updated_at = NOW()
             WHERE id = $2 AND is_active = true`,
            [data.newPassword, userId],
            0
          );
          console.log('✅ Retry update completed');
        }
      }
    } catch (updateError: any) {
      console.error('❌ Error updating password:', updateError);
      // Если поле password не существует, пробуем обновить только password_hash
      const errorMessage = updateError?.message || String(updateError);
      if (errorMessage.includes('column') && errorMessage.includes('password')) {
        console.log('⚠️ Field password does not exist, updating only password_hash');
        await query(
          `UPDATE users 
           SET password_hash = $1, updated_at = NOW()
           WHERE id = $2 AND is_active = true`,
          [newPasswordHash, userId],
          0
        );
      } else {
        throw updateError;
      }
    }

    return createSuccessResponse({
      message: 'Password updated successfully',
    } as ChangePasswordResponse['data']);
  } catch (error) {
    return handleError(error, 'change-password function');
  }
};
