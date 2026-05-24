/**
 * Lightweight IP rate limiting for auth verification endpoints.
 * Uses PostgreSQL hourly buckets — no Redis required.
 */

import type { HandlerEvent } from '@netlify/functions';
import { CORS_HEADERS } from './api-helpers';
import { query } from './db';
import { getClientIpFromEvent } from './yookassa-webhook-verify';

export const AUTH_VERIFICATION_IP_LIMIT = 10;
export const AUTH_VERIFICATION_IP_WINDOW_SECONDS = 3600;

const AUTH_VERIFICATION_BUCKET = 'auth_verification';

type IpRateLimitCheckResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function retryAfterFromWindowHour(windowHour: Date): number {
  const windowEnd = new Date(windowHour.getTime() + AUTH_VERIFICATION_IP_WINDOW_SECONDS * 1000);
  return Math.max(1, Math.ceil((windowEnd.getTime() - Date.now()) / 1000));
}

export async function checkAuthVerificationIpRateLimit(
  event: HandlerEvent
): Promise<IpRateLimitCheckResult> {
  const ip = getClientIpFromEvent(event) ?? 'unknown';

  const upsert = await query<{ request_count: number; window_hour: Date }>(
    `INSERT INTO auth_ip_rate_limits (ip_address, bucket_key, window_hour, request_count)
     VALUES ($1, $2, date_trunc('hour', NOW()), 1)
     ON CONFLICT (ip_address, bucket_key, window_hour)
     DO UPDATE SET request_count = auth_ip_rate_limits.request_count + 1
     WHERE auth_ip_rate_limits.request_count < $3
     RETURNING request_count, window_hour`,
    [ip, AUTH_VERIFICATION_BUCKET, AUTH_VERIFICATION_IP_LIMIT],
    0
  );

  if (upsert.rows.length > 0) {
    return { allowed: true };
  }

  const current = await query<{ window_hour: Date }>(
    `SELECT window_hour
     FROM auth_ip_rate_limits
     WHERE ip_address = $1
       AND bucket_key = $2
       AND window_hour = date_trunc('hour', NOW())`,
    [ip, AUTH_VERIFICATION_BUCKET],
    0
  );

  const windowHour = current.rows[0]?.window_hour;
  return {
    allowed: false,
    retryAfterSeconds: windowHour
      ? retryAfterFromWindowHour(windowHour)
      : AUTH_VERIFICATION_IP_WINDOW_SECONDS,
  };
}

export function authVerificationIpRateLimitResponse(retryAfterSeconds: number): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    statusCode: 429,
    headers: {
      ...CORS_HEADERS,
      'Retry-After': String(retryAfterSeconds),
    },
    body: JSON.stringify({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Too many requests. Please try again later.',
    }),
  };
}

export async function enforceAuthVerificationIpRateLimit(
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string } | null> {
  const result = await checkAuthVerificationIpRateLimit(event);
  if (result.allowed) {
    return null;
  }
  return authVerificationIpRateLimitResponse(result.retryAfterSeconds);
}
