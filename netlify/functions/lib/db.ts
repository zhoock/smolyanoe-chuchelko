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
      connectionTimeoutMillis: 5000, // Уменьшено до 5 секунд, так как Netlify Functions имеют лимит 10-26 секунд
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle PostgreSQL client', err);
    });
  }

  return pool;
}

/**
 * Выполняет SQL запрос с retry логикой.
 */
export async function query<T = any>(
  text: string,
  params?: any[],
  retries = 1 // Уменьшено количество retry для скорости
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Используем Promise.race для таймаута запроса (7 секунд)
      // Это гарантирует, что запрос не будет выполняться дольше
      const queryPromise = pool.query<T>(text, params);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 7 seconds')), 7000);
      });

      const result = await Promise.race([queryPromise, timeoutPromise]);
      const duration = Date.now() - start;

      if (attempt > 0) {
        console.log(`✅ Executed query (retry ${attempt})`, {
          text: text.substring(0, 100), // Ограничиваем длину лога
          duration,
          rows: result.rowCount,
        });
      } else {
        console.log('✅ Executed query', {
          text: text.substring(0, 100),
          duration,
          rows: result.rowCount,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      const isLastAttempt = attempt === retries;
      const isConnectionError =
        error instanceof Error &&
        (error.message.includes('timeout') ||
          error.message.includes('Connection terminated') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND'));

      if (isConnectionError && !isLastAttempt) {
        // Уменьшенная задержка для retry (без экспоненциального роста)
        const delay = 500; // Всего 500мс задержка
        console.warn(
          `⚠️ Connection error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
          {
            error: error instanceof Error ? error.message : error,
          }
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error('❌ Query error', {
        text: text.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : error,
        attempt,
      });
      throw error;
    }
  }

  // Этот код не должен выполняться, но TypeScript требует возврата
  throw new Error('Query failed after all retries');
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
