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
      console.error('❌ DATABASE_URL is not set!');
      throw new Error('DATABASE_URL environment variable is not set');
    }

    console.log('🔌 Initializing database pool...');

    // Логируем информацию о подключении (без пароля!)
    try {
      const url = new URL(connectionString);
      const isSupabase = url.hostname.includes('supabase.com');
      // Supabase всегда требует SSL
      const useSSL = isSupabase || process.env.NODE_ENV === 'production';

      console.log('🔌 Connecting to database:', {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.replace('/', ''),
        user: url.username,
        hasPassword: !!url.password,
        isSupabase,
        ssl: useSSL ? 'required' : 'disabled',
      });
    } catch (urlError) {
      console.warn('⚠️ Could not parse DATABASE_URL:', urlError);
    }

    // Определяем, нужен ли SSL
    // Supabase всегда требует SSL, даже в development
    const connectionUrl = connectionString.toLowerCase();
    const isSupabase = connectionUrl.includes('supabase.com');
    const useSSL = isSupabase || process.env.NODE_ENV === 'production';

    pool = new Pool({
      connectionString,
      // Настройки для serverless environments
      max: 1, // Минимум соединений для Netlify Functions
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000, // Увеличено до 15 секунд для холодного старта и медленных соединений
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle PostgreSQL client', err);
    });

    pool.on('connect', (client) => {
      console.log('✅ Database connection established');
    });

    // Пытаемся проверить соединение сразу
    pool
      .connect()
      .then((client) => {
        console.log('✅ Test connection successful');
        client.release();
      })
      .catch((err) => {
        console.error('❌ Test connection failed:', err.message);
        console.error('❌ Connection error details:', {
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
          address: err.address,
          port: err.port,
        });
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
  try {
    const pool = getPool();
    const start = Date.now();
    console.log('📊 Executing query:', {
      text: text.substring(0, 100),
      params: params?.length || 0,
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Убираем Promise.race - он мешает установлению соединения
        // connectionTimeoutMillis уже управляет таймаутом подключения
        // Даем запросу больше времени на выполнение (включая время на подключение)
        const result = await pool.query<T>(text, params);
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
            error.message.includes('ENOTFOUND') ||
            error.message.includes('getaddrinfo ENOTFOUND'));

        if (isConnectionError && !isLastAttempt) {
          // Уменьшенная задержка для retry (без экспоненциального роста)
          const delay = 500; // Всего 500мс задержка
          console.warn(
            `⚠️ Connection error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
            {
              error: error instanceof Error ? error.message : error,
              duration,
            }
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        console.error('❌ Query error', {
          text: text.substring(0, 100),
          duration,
          error: error instanceof Error ? error.message : error,
          errorStack: error instanceof Error ? error.stack : undefined,
          attempt,
        });
        throw error;
      }
    }

    // Этот код не должен выполняться, но TypeScript требует возврата
    throw new Error('Query failed after all retries');
  } catch (poolError) {
    console.error('❌ Failed to get database pool:', poolError);
    throw poolError;
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
