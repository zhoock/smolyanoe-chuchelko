/**
 * Полное удаление аккаунта пользователя (явный порядок, одна DB-транзакция).
 */

import type { PoolClient } from 'pg';
import * as bcrypt from 'bcryptjs';
import { withClient } from './db';
import { deleteAllUserStorageFiles } from './delete-user-storage';
import { sendAccountDeletedEmail } from './email';
import { normalizeEmailLocale } from './email-locale';

export class DeleteAccountError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'DeleteAccountError';
  }
}

interface UserAuthRow {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  preferred_language?: string | null;
}

export function mapDeleteAccountError(error: unknown): DeleteAccountError {
  if (error instanceof DeleteAccountError) return error;

  const pgCode = (error as { code?: string })?.code;
  if (pgCode === '23503') {
    return new DeleteAccountError(
      'Account deletion is blocked by related data. Contact support.',
      409,
      'DELETE_CONFLICT'
    );
  }

  console.error('❌ delete-user-account unexpected error:', error);
  return new DeleteAccountError(
    'Could not delete account. Please try again later.',
    500,
    'DELETE_FAILED'
  );
}

async function deleteUserDataInTransaction(
  client: PoolClient,
  userId: string,
  email: string
): Promise<void> {
  // 1. Archive (as subscriber and as artist in others' archives)
  await client.query(
    `DELETE FROM user_archive WHERE user_id = $1::uuid OR artist_user_id = $1::uuid`,
    [userId]
  );

  // 2. Premium subscription billing
  await client.query(`DELETE FROM subscription_payments WHERE user_id = $1::uuid`, [userId]);
  await client.query(`DELETE FROM subscriptions WHERE user_id = $1::uuid`, [userId]);

  // 3. Checkout data (buyer + albums sold by this artist)
  const orderScope = `user_id = $1::uuid
        OR LOWER(customer_email) = LOWER($2)
        OR album_id IN (SELECT DISTINCT album_id FROM albums WHERE user_id = $1::uuid)`;

  await client.query(
    `DELETE FROM payments
     WHERE order_id IN (SELECT id FROM orders WHERE ${orderScope})`,
    [userId, email]
  );

  await client.query(
    `DELETE FROM purchases
     WHERE order_id IN (SELECT id FROM orders WHERE ${orderScope})
        OR LOWER(customer_email) = LOWER($2)
        OR album_id IN (SELECT DISTINCT album_id FROM albums WHERE user_id = $1::uuid)`,
    [userId, email]
  );

  await client.query(`DELETE FROM orders WHERE ${orderScope}`, [userId, email]);

  // 4. Payment settings (seller credentials)
  await client.query(`DELETE FROM user_payment_settings WHERE user_id = $1`, [userId]);

  // 5. Tracks (explicit before albums)
  await client.query(
    `DELETE FROM tracks
     WHERE album_id IN (SELECT id FROM albums WHERE user_id = $1::uuid)`,
    [userId]
  );

  // 6. Synced lyrics
  await client.query(`DELETE FROM synced_lyrics WHERE user_id = $1::uuid`, [userId]);

  // 7. Articles / posts
  await client.query(`DELETE FROM articles WHERE user_id = $1::uuid`, [userId]);

  // 8. Albums
  await client.query(`DELETE FROM albums WHERE user_id = $1::uuid`, [userId]);

  // 9. User row last (email verification tokens live on users)
  const deleted = await client.query(`DELETE FROM users WHERE id = $1::uuid RETURNING id`, [
    userId,
  ]);

  if (deleted.rowCount === 0) {
    throw new DeleteAccountError('User not found', 404, 'USER_NOT_FOUND');
  }
}

export async function deleteUserAccount(
  userId: string,
  currentPassword: string
): Promise<{ deleted: true }> {
  if (!currentPassword?.trim()) {
    throw new DeleteAccountError('Current password is required', 400, 'PASSWORD_REQUIRED');
  }

  let deletedEmail: string | null = null;
  let deletedLocale = normalizeEmailLocale(null);

  await withClient(async (client) => {
    await client.query('BEGIN');

    try {
      const userResult = await client.query<UserAuthRow>(
        `SELECT id, email, password_hash, is_active, preferred_language
         FROM users
         WHERE id = $1::uuid
         FOR UPDATE`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new DeleteAccountError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        throw new DeleteAccountError('User account is disabled', 403, 'ACCOUNT_DISABLED');
      }

      const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!passwordValid) {
        throw new DeleteAccountError('Invalid current password', 401, 'INVALID_CREDENTIALS');
      }

      await deleteAllUserStorageFiles(userId);
      await deleteUserDataInTransaction(client, user.id, user.email);
      deletedEmail = user.email;
      deletedLocale = normalizeEmailLocale(user.preferred_language);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  if (deletedEmail) {
    const emailResult = await sendAccountDeletedEmail({ to: deletedEmail, locale: deletedLocale });
    if (!emailResult.success) {
      console.error('❌ Account deleted but confirmation email failed:', emailResult.error);
    }
  }

  return { deleted: true };
}
