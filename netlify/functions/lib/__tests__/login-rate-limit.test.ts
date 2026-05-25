/**
 * Unit tests for the login brute-force / credential-stuffing rate limiter.
 *
 * Strategy:
 *   - The pure helpers (`computeNextFailureState`, `evaluateBucketLock`,
 *     `normalizeEmailForBucket`) are tested directly — no mocks needed.
 *   - The DB-backed API (`checkLoginRateLimit`, `recordLoginFailure`,
 *     `resetLoginRateLimitOnSuccess`) is tested against an in-memory
 *     simulation of the `auth_login_rate_limits` table installed via
 *     `jest.mock('../db')`. The fake `query` recognizes the helper's SQL
 *     patterns and applies the SAME UPSERT semantics as the production SQL,
 *     so we exercise the public contract end-to-end without PostgreSQL.
 */

import type { HandlerEvent } from '@netlify/functions';

// ---------------------------------------------------------------------------
// In-memory fake of auth_login_rate_limits (shared with jest mock below)
// ---------------------------------------------------------------------------

interface FakeBucketRow {
  bucket_type: 'ip' | 'email';
  bucket_key: string;
  window_start: Date;
  failed_count: number;
  locked_until: Date | null;
  updated_at: Date;
}

type FakeTable = Map<string, FakeBucketRow>;

function bucketKey(row: Pick<FakeBucketRow, 'bucket_type' | 'bucket_key'>): string {
  return `${row.bucket_type}::${row.bucket_key}`;
}

const fakeTable: FakeTable = new Map();

/** Read the current (fake) wall clock. With jest.useFakeTimers this is also what `new Date()` returns. */
function nowFn(): Date {
  return new Date();
}

function clearFakeTable(): void {
  fakeTable.clear();
}

function advanceTime(seconds: number): void {
  jest.advanceTimersByTime(seconds * 1000);
}

function setNow(date: Date): void {
  jest.setSystemTime(date);
}

// ---------------------------------------------------------------------------
// Mock ../db with a fake `query` that understands the helper's SQL
// ---------------------------------------------------------------------------

jest.mock('../db', () => ({
  query: jest.fn(async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();

    // SELECT bucket_type, failed_count, window_start, locked_until ...
    if (sql.startsWith('SELECT bucket_type, failed_count, window_start, locked_until')) {
      const [email, ip] = params as [string, string | null];
      const rows: Omit<FakeBucketRow, 'updated_at' | 'bucket_key'>[] = [];
      for (const row of fakeTable.values()) {
        if (row.bucket_type === 'email' && row.bucket_key === email) {
          rows.push(row);
        } else if (ip != null && row.bucket_type === 'ip' && row.bucket_key === ip) {
          rows.push(row);
        }
      }
      return { rows };
    }

    // INSERT ... ON CONFLICT ... RETURNING (upsert failure)
    if (sql.startsWith('INSERT INTO auth_login_rate_limits')) {
      const [bucketType, key, windowSecondsRaw, thresholdRaw, lockoutSecondsRaw] = params as [
        'ip' | 'email',
        string,
        number,
        number,
        number,
      ];
      const windowSeconds = Number(windowSecondsRaw);
      const threshold = Number(thresholdRaw);
      const lockoutSeconds = Number(lockoutSecondsRaw);
      const now = nowFn();

      const k = bucketKey({ bucket_type: bucketType, bucket_key: key });
      const existing = fakeTable.get(k);

      let nextWindowStart: Date;
      let nextCount: number;
      if (!existing) {
        nextWindowStart = now;
        nextCount = 1;
      } else {
        const windowExpired =
          existing.window_start.getTime() + windowSeconds * 1000 <= now.getTime();
        const lockExpired =
          existing.locked_until != null && existing.locked_until.getTime() <= now.getTime();
        if (windowExpired || lockExpired) {
          nextWindowStart = now;
          nextCount = 1;
        } else {
          nextWindowStart = existing.window_start;
          nextCount = existing.failed_count + 1;
        }
      }

      const nextLockedUntil =
        nextCount >= threshold ? new Date(now.getTime() + lockoutSeconds * 1000) : null;

      const row: FakeBucketRow = {
        bucket_type: bucketType,
        bucket_key: key,
        window_start: nextWindowStart,
        failed_count: nextCount,
        locked_until: nextLockedUntil,
        updated_at: now,
      };
      fakeTable.set(k, row);

      return {
        rows: [
          {
            bucket_type: row.bucket_type,
            failed_count: row.failed_count,
            window_start: row.window_start,
            locked_until: row.locked_until,
          },
        ],
      };
    }

    // DELETE FROM auth_login_rate_limits WHERE bucket_type = 'email' AND bucket_key = $1
    if (sql.startsWith('DELETE FROM auth_login_rate_limits')) {
      const [email] = params as [string];
      fakeTable.delete(bucketKey({ bucket_type: 'email', bucket_key: email }));
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in mock: ${sql}`);
  }),
}));

// ---------------------------------------------------------------------------
// Helpers for tests
// ---------------------------------------------------------------------------

function makeEvent(ip: string | null): HandlerEvent {
  const headers: Record<string, string> = {};
  if (ip) headers['x-forwarded-for'] = ip;
  return { headers } as unknown as HandlerEvent;
}

// Force a fresh module import per test so internal closure state (if any) is reset.
async function loadHelper() {
  return await import('../login-rate-limit');
}

beforeEach(() => {
  jest.resetModules();
  clearFakeTable();
  // Mock the system clock globally so both the helper (`new Date()`) and the
  // fake `query` (`nowFn`) share a single timeline. doNotFake avoids touching
  // microtask scheduling (which Jest needs for await).
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    now: new Date('2026-01-01T00:00:00Z'),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe('normalizeEmailForBucket', () => {
  it('lowercases and trims', async () => {
    const { normalizeEmailForBucket } = await loadHelper();
    expect(normalizeEmailForBucket('  User@Example.COM  ')).toBe('user@example.com');
  });

  it('caps at 255 characters', async () => {
    const { normalizeEmailForBucket } = await loadHelper();
    const long = 'a'.repeat(400) + '@example.com';
    expect(normalizeEmailForBucket(long).length).toBeLessThanOrEqual(255);
  });
});

describe('computeNextFailureState (pure)', () => {
  const config = { windowSeconds: 900, threshold: 5, lockoutSeconds: 900 };

  it('starts at 1 when no prior state exists', async () => {
    const { computeNextFailureState } = await loadHelper();
    const now = new Date('2026-01-01T00:00:00Z');
    const next = computeNextFailureState(null, now, config);
    expect(next.failedCount).toBe(1);
    expect(next.windowStart.toISOString()).toBe(now.toISOString());
    expect(next.lockedUntil).toBeNull();
  });

  it('increments within a live window', async () => {
    const { computeNextFailureState } = await loadHelper();
    const now = new Date('2026-01-01T00:05:00Z');
    const existing = {
      failedCount: 2,
      windowStart: new Date('2026-01-01T00:00:00Z'),
      lockedUntil: null,
    };
    const next = computeNextFailureState(existing, now, config);
    expect(next.failedCount).toBe(3);
    expect(next.windowStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(next.lockedUntil).toBeNull();
  });

  it('locks once the threshold is reached', async () => {
    const { computeNextFailureState } = await loadHelper();
    const now = new Date('2026-01-01T00:05:00Z');
    const existing = {
      failedCount: 4,
      windowStart: new Date('2026-01-01T00:00:00Z'),
      lockedUntil: null,
    };
    const next = computeNextFailureState(existing, now, config);
    expect(next.failedCount).toBe(5);
    expect(next.lockedUntil).not.toBeNull();
    expect(next.lockedUntil!.getTime()).toBe(now.getTime() + config.lockoutSeconds * 1000);
  });

  it('resets when the window has expired', async () => {
    const { computeNextFailureState } = await loadHelper();
    const now = new Date('2026-01-01T01:00:00Z');
    const existing = {
      failedCount: 4,
      windowStart: new Date('2026-01-01T00:00:00Z'),
      lockedUntil: null,
    };
    const next = computeNextFailureState(existing, now, config);
    expect(next.failedCount).toBe(1);
    expect(next.windowStart.toISOString()).toBe(now.toISOString());
    expect(next.lockedUntil).toBeNull();
  });

  it('resets when a prior lockout has expired', async () => {
    const { computeNextFailureState } = await loadHelper();
    const now = new Date('2026-01-01T01:00:00Z');
    const existing = {
      failedCount: 5,
      windowStart: new Date('2026-01-01T00:00:00Z'),
      lockedUntil: new Date('2026-01-01T00:15:00Z'),
    };
    const next = computeNextFailureState(existing, now, config);
    expect(next.failedCount).toBe(1);
    expect(next.lockedUntil).toBeNull();
  });
});

describe('evaluateBucketLock (pure)', () => {
  it('reports not-locked when state is null', async () => {
    const { evaluateBucketLock } = await loadHelper();
    const r = evaluateBucketLock(null, new Date());
    expect(r.locked).toBe(false);
    expect(r.retryAfterSeconds).toBe(0);
  });

  it('reports not-locked when lockedUntil is in the past', async () => {
    const { evaluateBucketLock } = await loadHelper();
    const r = evaluateBucketLock(
      {
        failedCount: 5,
        windowStart: new Date('2026-01-01T00:00:00Z'),
        lockedUntil: new Date('2026-01-01T00:15:00Z'),
      },
      new Date('2026-01-01T01:00:00Z')
    );
    expect(r.locked).toBe(false);
  });

  it('reports locked with positive retry-after when in lockout', async () => {
    const { evaluateBucketLock } = await loadHelper();
    const r = evaluateBucketLock(
      {
        failedCount: 5,
        windowStart: new Date('2026-01-01T00:00:00Z'),
        lockedUntil: new Date('2026-01-01T00:15:00Z'),
      },
      new Date('2026-01-01T00:10:00Z')
    );
    expect(r.locked).toBe(true);
    expect(r.retryAfterSeconds).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// DB-backed API tests
// ---------------------------------------------------------------------------

describe('recordLoginFailure / checkLoginRateLimit (email bucket)', () => {
  it('increments the email bucket and locks at the 5th attempt', async () => {
    const { recordLoginFailure, checkLoginRateLimit, LOGIN_FAILURES_PER_EMAIL } =
      await loadHelper();
    const event = makeEvent('1.1.1.1');
    const email = 'victim@example.com';

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL - 1; i++) {
      const check = await checkLoginRateLimit(event, email);
      expect(check.allowed).toBe(true);
      await recordLoginFailure(event, email);
      advanceTime(1);
    }
    // Still allowed right before the lockout-creating attempt.
    expect((await checkLoginRateLimit(event, email)).allowed).toBe(true);

    // The 5th failure triggers the lock.
    await recordLoginFailure(event, email);

    const blocked = await checkLoginRateLimit(event, email);
    expect(blocked.allowed).toBe(false);
    expect(blocked.bucket).toBe('email');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('returns an accurate Retry-After (seconds remaining in lockout)', async () => {
    const {
      recordLoginFailure,
      checkLoginRateLimit,
      LOGIN_FAILURES_PER_EMAIL,
      LOGIN_LOCKOUT_SECONDS,
    } = await loadHelper();
    const event = makeEvent('1.1.1.1');
    const email = 'victim2@example.com';

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL; i++) {
      await recordLoginFailure(event, email);
    }

    const blocked = await checkLoginRateLimit(event, email);
    expect(blocked.allowed).toBe(false);
    // Lockout was just set so retry-after should equal LOGIN_LOCKOUT_SECONDS (±1s).
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(LOGIN_LOCKOUT_SECONDS - 1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(LOGIN_LOCKOUT_SECONDS);

    // Halfway through the lockout, retry-after halves.
    advanceTime(Math.floor(LOGIN_LOCKOUT_SECONDS / 2));
    const midway = await checkLoginRateLimit(event, email);
    expect(midway.allowed).toBe(false);
    expect(midway.retryAfterSeconds).toBeLessThanOrEqual(Math.ceil(LOGIN_LOCKOUT_SECONDS / 2));
    expect(midway.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('auto-unlocks once the lockout window expires', async () => {
    const {
      recordLoginFailure,
      checkLoginRateLimit,
      LOGIN_FAILURES_PER_EMAIL,
      LOGIN_LOCKOUT_SECONDS,
    } = await loadHelper();
    const event = makeEvent('1.1.1.1');
    const email = 'victim3@example.com';

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL; i++) {
      await recordLoginFailure(event, email);
    }
    expect((await checkLoginRateLimit(event, email)).allowed).toBe(false);

    advanceTime(LOGIN_LOCKOUT_SECONDS + 1);
    expect((await checkLoginRateLimit(event, email)).allowed).toBe(true);

    // A failure after the unlock starts a fresh window at count = 1.
    const reLock = await recordLoginFailure(event, email);
    expect(reLock.allowed).toBe(true); // count = 1 < threshold
  });

  it('resets the email bucket on success but preserves IP counters', async () => {
    const {
      recordLoginFailure,
      checkLoginRateLimit,
      resetLoginRateLimitOnSuccess,
      LOGIN_FAILURES_PER_EMAIL,
    } = await loadHelper();
    const event = makeEvent('1.1.1.1');
    const email = 'victim4@example.com';

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL - 1; i++) {
      await recordLoginFailure(event, email);
    }
    // 4 strikes on the email, 4 strikes on the IP — neither locked yet.
    expect((await checkLoginRateLimit(event, email)).allowed).toBe(true);

    await resetLoginRateLimitOnSuccess(email);

    // Email row gone — should not be locked even after many fresh attacks via the same email below threshold.
    expect((await checkLoginRateLimit(event, email)).allowed).toBe(true);

    // IP row is still present (4 strikes) — verify it carries over by inspecting the table directly via another email.
    const otherEmail = 'other@example.com';
    // 16 more IP strikes (one per failed attempt on otherEmail) would bring IP to 20 → lock.
    // Use that as an indirect probe that the IP bucket wasn't reset.
    const { LOGIN_FAILURES_PER_IP } = await loadHelper();
    const remainingIpFailuresUntilLock = LOGIN_FAILURES_PER_IP - (LOGIN_FAILURES_PER_EMAIL - 1);
    for (let i = 0; i < remainingIpFailuresUntilLock - 1; i++) {
      await recordLoginFailure(event, `bot-${i}@example.com`);
    }
    expect((await checkLoginRateLimit(event, otherEmail)).allowed).toBe(true);
    await recordLoginFailure(event, otherEmail);
    expect((await checkLoginRateLimit(event, otherEmail)).allowed).toBe(false);
  });
});

describe('IP bucket — one IP attacking many emails', () => {
  it('locks the IP after LOGIN_FAILURES_PER_IP failures across different emails', async () => {
    const { recordLoginFailure, checkLoginRateLimit, LOGIN_FAILURES_PER_IP } = await loadHelper();
    const event = makeEvent('9.9.9.9');

    for (let i = 0; i < LOGIN_FAILURES_PER_IP - 1; i++) {
      await recordLoginFailure(event, `target-${i}@example.com`);
    }
    expect((await checkLoginRateLimit(event, 'fresh@example.com')).allowed).toBe(true);

    await recordLoginFailure(event, `target-${LOGIN_FAILURES_PER_IP - 1}@example.com`);

    const blocked = await checkLoginRateLimit(event, 'completely-new@example.com');
    expect(blocked.allowed).toBe(false);
    expect(blocked.bucket).toBe('ip');
  });

  it('still rate-limits when IP is missing (email bucket only)', async () => {
    const { recordLoginFailure, checkLoginRateLimit, LOGIN_FAILURES_PER_EMAIL } =
      await loadHelper();
    const event = makeEvent(null);
    const email = 'no-ip-victim@example.com';

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL; i++) {
      await recordLoginFailure(event, email);
    }
    const blocked = await checkLoginRateLimit(event, email);
    expect(blocked.allowed).toBe(false);
    expect(blocked.bucket).toBe('email');
  });
});

describe('email bucket — many IPs attacking one email (proxy rotation)', () => {
  it('locks the email even when each request comes from a different IP', async () => {
    const { recordLoginFailure, checkLoginRateLimit, LOGIN_FAILURES_PER_EMAIL } =
      await loadHelper();
    const email = 'high-value@example.com';

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL; i++) {
      const event = makeEvent(`10.0.0.${i + 1}`);
      await recordLoginFailure(event, email);
    }

    const blocked = await checkLoginRateLimit(makeEvent('10.0.0.99'), email);
    expect(blocked.allowed).toBe(false);
    expect(blocked.bucket).toBe('email');
  });
});

describe('multiple IPs → same email', () => {
  it('one IP at <threshold and another at <threshold sum at the email bucket', async () => {
    const { recordLoginFailure, checkLoginRateLimit, LOGIN_FAILURES_PER_EMAIL } =
      await loadHelper();
    const email = 'shared-victim@example.com';

    // 3 strikes from IP A
    for (let i = 0; i < 3; i++) await recordLoginFailure(makeEvent('1.1.1.1'), email);
    // 2 strikes from IP B → email bucket = 5 → locked
    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL - 3; i++)
      await recordLoginFailure(makeEvent('2.2.2.2'), email);

    expect((await checkLoginRateLimit(makeEvent('3.3.3.3'), email)).allowed).toBe(false);
  });
});

describe('case insensitivity / normalization', () => {
  it('treats MIXED-CASE email and lowercase email as the same bucket', async () => {
    const { recordLoginFailure, checkLoginRateLimit, LOGIN_FAILURES_PER_EMAIL } =
      await loadHelper();
    const upper = '  Victim@Example.COM  ';
    const lower = 'victim@example.com';
    const event = makeEvent('5.5.5.5');

    for (let i = 0; i < LOGIN_FAILURES_PER_EMAIL; i++) {
      await recordLoginFailure(event, upper);
    }
    expect((await checkLoginRateLimit(event, lower)).allowed).toBe(false);
  });
});

describe('loginRateLimitResponse', () => {
  it('returns 429 with Retry-After header and generic body', async () => {
    const { loginRateLimitResponse } = await loadHelper();
    const r = loginRateLimitResponse(120);
    expect(r.statusCode).toBe(429);
    expect(r.headers['Retry-After']).toBe('120');
    const body = JSON.parse(r.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(typeof body.error).toBe('string');
    // No user-enumeration vector: error message must not reference email / password / account.
    expect(body.error).not.toMatch(/email/i);
    expect(body.error).not.toMatch(/password/i);
    expect(body.error).not.toMatch(/account/i);
  });

  it('enforces a minimum Retry-After of 1 second', async () => {
    const { loginRateLimitResponse } = await loadHelper();
    expect(loginRateLimitResponse(0).headers['Retry-After']).toBe('1');
    expect(loginRateLimitResponse(-50).headers['Retry-After']).toBe('1');
  });
});

describe('graceful degradation (DB errors)', () => {
  it('checkLoginRateLimit fails open when the table query throws', async () => {
    jest.resetModules();
    jest.doMock('../db', () => ({
      query: jest.fn(async () => {
        throw new Error('relation "auth_login_rate_limits" does not exist');
      }),
    }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { checkLoginRateLimit } = await import('../login-rate-limit');
    const r = await checkLoginRateLimit(makeEvent('8.8.8.8'), 'someone@example.com');
    expect(r.allowed).toBe(true);

    warn.mockRestore();
  });

  it('recordLoginFailure fails open when the upsert throws', async () => {
    jest.resetModules();
    jest.doMock('../db', () => ({
      query: jest.fn(async () => {
        throw new Error('connection refused');
      }),
    }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { recordLoginFailure } = await import('../login-rate-limit');
    const r = await recordLoginFailure(makeEvent('8.8.8.8'), 'someone@example.com');
    expect(r.allowed).toBe(true);

    warn.mockRestore();
  });
});
