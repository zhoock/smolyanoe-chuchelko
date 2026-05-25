/**
 * Login brute-force / credential-stuffing protection.
 *
 * Uses two parallel PostgreSQL-backed buckets (no Redis):
 *   - IP bucket    — limits failures from a single IP across all emails
 *   - email bucket — limits failures against a single email across all IPs
 *
 * Behavior:
 *   - On a credential failure (unknown email OR wrong password) both buckets are
 *     incremented; when a bucket reaches its threshold it is locked for a
 *     temporary cooldown.
 *   - On a successful login the email bucket is purged. The IP bucket is
 *     intentionally NOT cleared on success: a valid login on a shared IP must
 *     not unlock subsequent brute-force attempts from the same IP.
 *   - On infrastructure errors the helpers fail OPEN (login still works) — we
 *     never block legitimate users because of a flaky rate-limit table.
 *
 * Only failed CREDENTIAL checks count. Network errors, validation errors
 * (missing fields), and successful logins do not increment counters.
 */

import type { HandlerEvent } from '@netlify/functions';
import { CORS_HEADERS } from './api-helpers';
import { query } from './db';
import { getClientIpFromEvent } from './yookassa-webhook-verify';

// ---------------------------------------------------------------------------
// Public configuration
// ---------------------------------------------------------------------------

/** Rolling window for counting failures (both buckets). */
export const LOGIN_WINDOW_SECONDS = 15 * 60; // 15 minutes
/** Temporary lockout duration once a bucket crosses its threshold. */
export const LOGIN_LOCKOUT_SECONDS = 15 * 60; // 15 minutes
/** Email bucket — strict (catches credential stuffing on one account). */
export const LOGIN_FAILURES_PER_EMAIL = 5;
/** IP bucket — looser (accommodates shared NAT / corporate proxies). */
export const LOGIN_FAILURES_PER_IP = 20;

export type LoginBucketType = 'ip' | 'email';

export interface RateLimitConfig {
  windowSeconds: number;
  threshold: number;
  lockoutSeconds: number;
}

export interface BucketState {
  failedCount: number;
  windowStart: Date;
  lockedUntil: Date | null;
}

export interface LoginRateLimitCheck {
  allowed: boolean;
  retryAfterSeconds: number;
  bucket: LoginBucketType | null;
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB) — easy to unit-test
// ---------------------------------------------------------------------------

function isWindowExpired(state: BucketState, now: Date, windowSeconds: number): boolean {
  return state.windowStart.getTime() + windowSeconds * 1000 <= now.getTime();
}

function isLockoutCleared(state: BucketState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime();
}

/**
 * Compute the next bucket state after a failure. Pure function — mirrors the
 * UPSERT logic so we can unit-test it without a database.
 */
export function computeNextFailureState(
  existing: BucketState | null,
  now: Date,
  config: RateLimitConfig
): BucketState {
  const shouldReset =
    existing === null ||
    isWindowExpired(existing, now, config.windowSeconds) ||
    isLockoutCleared(existing, now);

  const nextCount = shouldReset ? 1 : existing!.failedCount + 1;
  const nextWindowStart = shouldReset ? now : existing!.windowStart;
  const nextLockedUntil =
    nextCount >= config.threshold ? new Date(now.getTime() + config.lockoutSeconds * 1000) : null;

  return {
    failedCount: nextCount,
    windowStart: nextWindowStart,
    lockedUntil: nextLockedUntil,
  };
}

/**
 * Decide if a bucket currently blocks the request. Pure function.
 */
export function evaluateBucketLock(
  state: BucketState | null,
  now: Date
): { locked: boolean; retryAfterSeconds: number } {
  if (!state || !state.lockedUntil) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  const remainingMs = state.lockedUntil.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
}

// ---------------------------------------------------------------------------
// Email / IP normalization
// ---------------------------------------------------------------------------

const EMAIL_BUCKET_MAX_LENGTH = 255;

export function normalizeEmailForBucket(email: string): string {
  return email.toLowerCase().trim().slice(0, EMAIL_BUCKET_MAX_LENGTH);
}

export function getLoginClientIp(event: HandlerEvent): string | null {
  const ip = getClientIpFromEvent(event);
  if (!ip) return null;
  const trimmed = ip.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 45);
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

interface BucketRow {
  bucket_type: LoginBucketType;
  failed_count: number;
  window_start: Date | string;
  locked_until: Date | string | null;
}

function rowToState(row: BucketRow): BucketState {
  return {
    failedCount: Number(row.failed_count),
    windowStart: new Date(row.window_start),
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
  };
}

const EMAIL_CONFIG: RateLimitConfig = {
  windowSeconds: LOGIN_WINDOW_SECONDS,
  threshold: LOGIN_FAILURES_PER_EMAIL,
  lockoutSeconds: LOGIN_LOCKOUT_SECONDS,
};

const IP_CONFIG: RateLimitConfig = {
  windowSeconds: LOGIN_WINDOW_SECONDS,
  threshold: LOGIN_FAILURES_PER_IP,
  lockoutSeconds: LOGIN_LOCKOUT_SECONDS,
};

function configForBucket(bucketType: LoginBucketType): RateLimitConfig {
  return bucketType === 'email' ? EMAIL_CONFIG : IP_CONFIG;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the given IP/email pair is currently locked out.
 * Fails OPEN (returns { allowed: true }) on infrastructure errors.
 */
export async function checkLoginRateLimit(
  event: HandlerEvent,
  email: string
): Promise<LoginRateLimitCheck> {
  const normalizedEmail = normalizeEmailForBucket(email);
  const ip = getLoginClientIp(event);

  try {
    const rows = await fetchBuckets(ip, normalizedEmail);
    const now = new Date();

    let worst: { lock: ReturnType<typeof evaluateBucketLock>; bucket: LoginBucketType } | null =
      null;
    for (const row of rows) {
      const lock = evaluateBucketLock(rowToState(row), now);
      if (!lock.locked) continue;
      if (!worst || lock.retryAfterSeconds > worst.lock.retryAfterSeconds) {
        worst = { lock, bucket: row.bucket_type };
      }
    }

    if (worst) {
      return {
        allowed: false,
        retryAfterSeconds: worst.lock.retryAfterSeconds,
        bucket: worst.bucket,
      };
    }

    return { allowed: true, retryAfterSeconds: 0, bucket: null };
  } catch (error) {
    console.warn('⚠️ login-rate-limit: checkLoginRateLimit failed open', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, retryAfterSeconds: 0, bucket: null };
  }
}

/**
 * Record a failed credential attempt against both buckets. After incrementing,
 * returns whether the request is now locked (so the caller can decide whether
 * to surface a 429 immediately if desired). Fails OPEN on infrastructure errors.
 */
export async function recordLoginFailure(
  event: HandlerEvent,
  email: string
): Promise<LoginRateLimitCheck> {
  const normalizedEmail = normalizeEmailForBucket(email);
  const ip = getLoginClientIp(event);

  const results: Array<{ bucket: LoginBucketType; state: BucketState }> = [];

  if (normalizedEmail.length > 0) {
    const emailState = await upsertFailure('email', normalizedEmail).catch((error) => {
      console.warn('⚠️ login-rate-limit: recordLoginFailure(email) failed open', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    if (emailState) results.push({ bucket: 'email', state: emailState });
  }

  if (ip) {
    const ipState = await upsertFailure('ip', ip).catch((error) => {
      console.warn('⚠️ login-rate-limit: recordLoginFailure(ip) failed open', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    if (ipState) results.push({ bucket: 'ip', state: ipState });
  }

  const now = new Date();
  let worst: { lock: ReturnType<typeof evaluateBucketLock>; bucket: LoginBucketType } | null = null;
  for (const { bucket, state } of results) {
    const lock = evaluateBucketLock(state, now);
    if (!lock.locked) continue;
    if (!worst || lock.retryAfterSeconds > worst.lock.retryAfterSeconds) {
      worst = { lock, bucket };
    }
  }

  if (worst) {
    return {
      allowed: false,
      retryAfterSeconds: worst.lock.retryAfterSeconds,
      bucket: worst.bucket,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, bucket: null };
}

/**
 * Reset the email bucket after a successful login. The IP bucket is left
 * intact so a single legitimate login does not unlock further brute-force
 * attempts from a shared IP. Fails OPEN.
 */
export async function resetLoginRateLimitOnSuccess(email: string): Promise<void> {
  const normalizedEmail = normalizeEmailForBucket(email);
  if (!normalizedEmail) return;

  try {
    await query(
      `DELETE FROM auth_login_rate_limits
       WHERE bucket_type = 'email' AND bucket_key = $1`,
      [normalizedEmail],
      0
    );
  } catch (error) {
    console.warn('⚠️ login-rate-limit: resetLoginRateLimitOnSuccess failed open', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Standard 429 response for login rate limit. The body intentionally does not
 * disclose whether the email exists or which bucket triggered the lockout.
 */
export function loginRateLimitResponse(retryAfterSeconds: number) {
  const safeRetry = Math.max(1, Math.floor(retryAfterSeconds));
  return {
    statusCode: 429,
    headers: {
      ...CORS_HEADERS,
      'Retry-After': String(safeRetry),
    },
    body: JSON.stringify({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Too many login attempts. Please try again later.',
      retryAfterSeconds: safeRetry,
    }),
  };
}

// ---------------------------------------------------------------------------
// Internal SQL
// ---------------------------------------------------------------------------

async function fetchBuckets(ip: string | null, email: string): Promise<BucketRow[]> {
  if (!ip && !email) return [];

  const result = await query<BucketRow>(
    `SELECT bucket_type, failed_count, window_start, locked_until
     FROM auth_login_rate_limits
     WHERE (bucket_type = 'email' AND bucket_key = $1)
        OR ($2::text IS NOT NULL AND bucket_type = 'ip' AND bucket_key = $2)`,
    [email, ip],
    0
  );
  return result.rows;
}

async function upsertFailure(bucketType: LoginBucketType, bucketKey: string): Promise<BucketState> {
  const config = configForBucket(bucketType);

  const result = await query<BucketRow>(
    `INSERT INTO auth_login_rate_limits (bucket_type, bucket_key, window_start, failed_count, locked_until, updated_at)
     VALUES ($1, $2, NOW(), 1, NULL, NOW())
     ON CONFLICT (bucket_type, bucket_key) DO UPDATE
     SET
       window_start = (
         CASE
           WHEN auth_login_rate_limits.window_start + make_interval(secs => $3::int) <= NOW()
             OR (auth_login_rate_limits.locked_until IS NOT NULL AND auth_login_rate_limits.locked_until <= NOW())
           THEN NOW()
           ELSE auth_login_rate_limits.window_start
         END
       ),
       failed_count = (
         CASE
           WHEN auth_login_rate_limits.window_start + make_interval(secs => $3::int) <= NOW()
             OR (auth_login_rate_limits.locked_until IS NOT NULL AND auth_login_rate_limits.locked_until <= NOW())
           THEN 1
           ELSE auth_login_rate_limits.failed_count + 1
         END
       ),
       locked_until = (
         CASE
           WHEN (
             CASE
               WHEN auth_login_rate_limits.window_start + make_interval(secs => $3::int) <= NOW()
                 OR (auth_login_rate_limits.locked_until IS NOT NULL AND auth_login_rate_limits.locked_until <= NOW())
               THEN 1
               ELSE auth_login_rate_limits.failed_count + 1
             END
           ) >= $4::int
           THEN NOW() + make_interval(secs => $5::int)
           ELSE NULL
         END
       ),
       updated_at = NOW()
     RETURNING bucket_type, failed_count, window_start, locked_until`,
    [bucketType, bucketKey, config.windowSeconds, config.threshold, config.lockoutSeconds],
    0
  );

  if (result.rows.length === 0) {
    throw new Error(`auth_login_rate_limits upsert returned no rows (bucket=${bucketType})`);
  }
  return rowToState(result.rows[0]);
}
