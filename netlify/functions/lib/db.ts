/**
 * Утилиты для работы с PostgreSQL базой данных.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

/**
 * Инициализирует connection pool для PostgreSQL.
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      // Настройки для serverless environments
      max: 1, // Минимум соединений для Netlify Functions
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle PostgreSQL client', err);
    });
  }

  return pool;
}

/**
 * Выполняет SQL запрос.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    console.log('✅ Executed query', { text, duration, rows: result.rowCount });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Query error', { text, duration, error });

    throw error;
  }
}

/**
 * Получает клиент для транзакций.
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

/**
 * Закрывает connection pool.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Типы для настроек платежей в БД
 */
export interface PaymentSettingsRow {
  id: string;
  user_id: string;
  provider: string;
  shop_id: string | null;
  secret_key_encrypted: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
}
