/**
 * Runtime detection for purchases table columns (pre/post migration).
 * No in-memory cache: migrations may run while dev server stays up.
 */

import { query } from './db';

async function hasColumn(columnName: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'purchases'
        AND column_name = $1
    ) AS exists`,
    [columnName]
  );

  return result.rows[0]?.exists ?? false;
}

export async function purchasesHasUserIdColumn(): Promise<boolean> {
  return hasColumn('user_id');
}

export async function purchasesHasRevokedColumns(): Promise<boolean> {
  return hasColumn('revoked_at');
}

/** SQL fragment: active (non-revoked) purchases only. */
export async function activePurchaseFilter(alias = ''): Promise<string> {
  const hasRevoked = await purchasesHasRevokedColumns();
  if (!hasRevoked) {
    return '';
  }
  const prefix = alias ? `${alias}.` : '';
  return `AND ${prefix}revoked_at IS NULL`;
}
