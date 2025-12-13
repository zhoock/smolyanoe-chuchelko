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
    let connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.error('❌ DATABASE_URL is not set!');
      throw new Error('DATABASE_URL environment variable is not set');
    }

    console.log('🔌 Initializing database pool...');

    // Логируем информацию о подключении (без пароля!)
    // НЕ конвертируем pooler → direct, так как правильный формат hostname неизвестен
    // Используем DATABASE_URL как есть из Netlify env
    try {
      const url = new URL(connectionString);
      const isSupabase =
        url.hostname.includes('supabase.com') || url.hostname.includes('supabase.co');
      const isPooler = url.hostname.includes('.pooler.');
      // Supabase всегда требует SSL
      const useSSL = isSupabase || process.env.NODE_ENV === 'production';

      console.log('🔌 Connecting to database:', {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.replace('/', ''),
        user: url.username,
        hasPassword: !!url.password,
        isSupabase,
        isPooler,
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
      connectionTimeoutMillis: 60000, // Увеличено до 60 секунд для обхода блокировок и медленных подключений
      keepAlive: true, // Поддержание соединения активным
      keepAliveInitialDelayMillis: 10000, // Начальная задержка перед keepAlive
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle PostgreSQL client', err);
    });

    pool.on('connect', (client) => {
      console.log('✅ Database connection established');
    });

    // НЕ делаем тестовое подключение при инициализации
    // Это создает лишние соединения и может привести к лимитам Supabase pooler
    // Соединение установится автоматически при первом запросе
  }

  return pool;
}

/**
 * Выполняет SQL запрос с retry логикой.
 */
export async function query<T = any>(
  text: string,
  params?: any[],
  retries = 2 // Увеличено количество retry для надежности при блокировках
): Promise<QueryResult<T>> {
  try {
    const pool = getPool();
    const start = Date.now();
    console.log('📊 Executing query:', {
      text: text.substring(0, 200), // Увеличено до 200 символов, чтобы видеть полный запрос
      params: params || [],
      paramsCount: params?.length || 0,
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
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('Connection terminated') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('getaddrinfo ENOTFOUND'));

        // Проверяем ошибку MaxClientsInSessionMode - может приходить как Error или как объект с code
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as any)?.code || (error as any)?.name || '';
        const errorString = String(error);
        const isMaxClientsError =
          errorMessage.includes('MaxClientsInSessionMode') ||
          errorMessage.includes('max clients reached') ||
          errorCode.includes('MaxClients') ||
          errorString.includes('MaxClientsInSessionMode') ||
          errorString.includes('max clients reached');

        // Обработка ошибки превышения лимита клиентов Supabase
        if (isMaxClientsError && !isLastAttempt) {
          // При превышении лимита клиентов делаем retry с увеличенной задержкой
          // Это дает время другим подключениям освободиться
          const delay = 2000 * (attempt + 1); // Увеличиваем задержку: 2s, 4s, 6s
          console.warn(
            `⚠️ Max clients reached, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
            {
              error: error instanceof Error ? error.message : error,
              duration,
            }
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isConnectionError && !isLastAttempt) {
          // Для Supabase pooler - не делаем retry при таймауте подключения
          // Это означает, что pooler перегружен, retry только усугубит ситуацию
          const isConnectionTimeout =
            error instanceof Error &&
            (error.message.includes('connection timeout') ||
              error.message.includes('timeout exceeded when trying to connect') ||
              error.message.includes('ETIMEDOUT') ||
              error.message.toLowerCase().includes('read etimedout'));

          if (isConnectionTimeout && attempt < retries) {
            // При таймауте подключения делаем retry с увеличенной задержкой
            // Это помогает при временных блокировках ISP
            const delay = 1000 * (attempt + 1); // Увеличиваем задержку с каждой попыткой
            console.warn(
              `⚠️ Connection timeout, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
              {
                error: error instanceof Error ? error.message : error,
                duration,
              }
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          if (isConnectionTimeout) {
            console.error(`❌ Connection timeout after ${retries + 1} attempts`, {
              error: error instanceof Error ? error.message : error,
              duration,
            });
            throw error;
          }

          // Для других ошибок подключения - делаем retry с задержкой
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
