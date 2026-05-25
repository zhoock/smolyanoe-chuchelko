/**
 * Unit tests for the password-reset helper.
 *
 * The DB-backed functions are tested against an in-memory simulation of the
 * `users` table installed via `jest.mock('../db')`. The fake `query`
 * recognizes the helper's SQL patterns so we exercise the public contract
 * end-to-end without PostgreSQL.
 */

// ---------------------------------------------------------------------------
// In-memory fake of `users` (shared with jest mock below)
// ---------------------------------------------------------------------------

interface FakeUserRow {
  id: string;
  email: string;
  name: string | null;
  is_active: boolean;
  preferred_language: string | null;
  password_reset_token_hash: string | null;
  password_reset_expires_at: Date | null;
  password_reset_requested_at: Date | null;
  password_hash: string | null;
}

const fakeUsers = new Map<string, FakeUserRow>();

function clearUsers(): void {
  fakeUsers.clear();
}

function seedUser(row: Partial<FakeUserRow> & { id: string; email: string }): FakeUserRow {
  const user: FakeUserRow = {
    name: null,
    is_active: true,
    preferred_language: null,
    password_reset_token_hash: null,
    password_reset_expires_at: null,
    password_reset_requested_at: null,
    password_hash: null,
    ...row,
  };
  fakeUsers.set(user.id, user);
  return user;
}

// Email module instantiates `new Resend(process.env.RESEND_API_KEY)` at import
// time, which throws when no API key is set. The reset-flow tests never
// exercise email delivery, so a thin stub is fine.
jest.mock('../email', () => ({
  sendPasswordResetEmail: jest.fn(async () => ({ success: true })),
}));

jest.mock('../db', () => ({
  query: jest.fn(async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();

    // SELECT … FROM users WHERE email = $1
    if (
      sql.startsWith('SELECT id, email, name, is_active, preferred_language FROM users WHERE email')
    ) {
      const [email] = params as [string];
      const row = Array.from(fakeUsers.values()).find((u) => u.email === email);
      return { rows: row ? [row] : [] };
    }

    // UPDATE users SET password_reset_requested_at = NOW() … RETURNING id
    if (sql.startsWith('UPDATE users SET password_reset_requested_at = NOW()')) {
      const [userId, cooldownSeconds] = params as [string, number];
      const user = fakeUsers.get(userId);
      if (!user) return { rows: [] };
      const now = new Date();
      const last = user.password_reset_requested_at;
      const allowed = last == null || now.getTime() - last.getTime() >= cooldownSeconds * 1000;
      if (!allowed) return { rows: [] };
      user.password_reset_requested_at = now;
      return { rows: [{ id: user.id }] };
    }

    // SELECT password_reset_requested_at FROM users WHERE id = $1
    if (sql.startsWith('SELECT password_reset_requested_at FROM users WHERE id')) {
      const [userId] = params as [string];
      const user = fakeUsers.get(userId);
      return {
        rows: user ? [{ password_reset_requested_at: user.password_reset_requested_at }] : [],
      };
    }

    // UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2 …
    if (
      sql.startsWith(
        'UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2'
      )
    ) {
      const [hash, expiresIso, userId] = params as [string, string, string];
      const user = fakeUsers.get(userId);
      if (user) {
        user.password_reset_token_hash = hash;
        user.password_reset_expires_at = new Date(expiresIso);
      }
      return { rows: [] };
    }

    // SELECT id, password_reset_expires_at, is_active FROM users WHERE password_reset_token_hash = $1
    if (
      sql.startsWith(
        'SELECT id, password_reset_expires_at, is_active FROM users WHERE password_reset_token_hash'
      )
    ) {
      const [hash] = params as [string];
      const row = Array.from(fakeUsers.values()).find((u) => u.password_reset_token_hash === hash);
      if (!row) return { rows: [] };
      return {
        rows: [
          {
            id: row.id,
            password_reset_expires_at: row.password_reset_expires_at,
            is_active: row.is_active,
          },
        ],
      };
    }

    // UPDATE users SET password_hash = $1, password_reset_* = NULL WHERE id = $2 AND is_active = true
    if (sql.startsWith('UPDATE users SET password_hash = $1, password_reset_token_hash = NULL')) {
      const [hash, userId] = params as [string, string];
      const user = fakeUsers.get(userId);
      if (user && user.is_active) {
        user.password_hash = hash;
        user.password_reset_token_hash = null;
        user.password_reset_expires_at = null;
        user.password_reset_requested_at = null;
      }
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in mock: ${sql}`);
  }),
}));

// Pull in the module under test AFTER the mock has been installed.
import {
  applyPasswordResetForUser,
  assertPasswordResetAllowed,
  assignPasswordResetToken,
  findActiveResetTokenOwner,
  findUserByEmailForReset,
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TTL_MINUTES,
  validateNewPassword,
} from '../password-reset';
import * as bcrypt from 'bcryptjs';

beforeEach(() => {
  // NOTE: deliberately not `resetAllMocks` — that would clear the SQL-dispatch
  // implementation of `query`. We only need to wipe the in-memory rows.
  clearUsers();
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    now: new Date('2026-01-01T00:00:00Z'),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('hashPasswordResetToken', () => {
  it('returns a deterministic SHA-256 hex digest', () => {
    const a = hashPasswordResetToken('hello');
    const b = hashPasswordResetToken('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different inputs', () => {
    expect(hashPasswordResetToken('a')).not.toBe(hashPasswordResetToken('b'));
  });
});

describe('generatePasswordResetToken', () => {
  it('returns matching raw token and SHA-256 digest', () => {
    const { token, tokenHash } = generatePasswordResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(tokenHash).toBe(hashPasswordResetToken(token));
  });

  it('produces unique tokens across calls', () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('validateNewPassword', () => {
  it('rejects empty / non-string', () => {
    expect(validateNewPassword('')?.code).toBe('PASSWORD_REQUIRED');
    expect(validateNewPassword(undefined)?.code).toBe('PASSWORD_REQUIRED');
    expect(validateNewPassword(null)?.code).toBe('PASSWORD_REQUIRED');
    expect(validateNewPassword(42 as unknown as string)?.code).toBe('PASSWORD_REQUIRED');
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(validateNewPassword('abc')?.code).toBe('PASSWORD_TOO_SHORT');
    expect(validateNewPassword('1234567')?.code).toBe('PASSWORD_TOO_SHORT');
  });

  it('rejects passwords longer than 200 chars', () => {
    expect(validateNewPassword('a'.repeat(201))?.code).toBe('PASSWORD_TOO_LONG');
  });

  it('accepts passwords in [8, 200] chars', () => {
    expect(validateNewPassword('12345678')).toBeNull();
    expect(validateNewPassword('a'.repeat(200))).toBeNull();
  });
});

describe('findUserByEmailForReset', () => {
  it('matches lower-cased email', async () => {
    seedUser({ id: 'u1', email: 'alex@example.com' });
    const found = await findUserByEmailForReset('  ALEX@example.COM  ');
    expect(found?.id).toBe('u1');
  });

  it('returns null when missing', async () => {
    const found = await findUserByEmailForReset('nobody@example.com');
    expect(found).toBeNull();
  });

  it('returns null for empty input', async () => {
    expect(await findUserByEmailForReset('')).toBeNull();
    expect(await findUserByEmailForReset('   ')).toBeNull();
  });
});

describe('assertPasswordResetAllowed', () => {
  it('allows the first request and sets requested_at', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    const result = await assertPasswordResetAllowed('u1');
    expect(result.allowed).toBe(true);
    expect(fakeUsers.get('u1')?.password_reset_requested_at).toBeInstanceOf(Date);
  });

  it('blocks back-to-back requests within the per-user cooldown', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    await assertPasswordResetAllowed('u1');

    const second = await assertPasswordResetAllowed('u1');
    expect(second.allowed).toBe(false);
    if (!second.allowed) {
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
      expect(second.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it('allows again after the cooldown elapses', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    await assertPasswordResetAllowed('u1');
    jest.advanceTimersByTime(61_000);
    const result = await assertPasswordResetAllowed('u1');
    expect(result.allowed).toBe(true);
  });
});

describe('assignPasswordResetToken', () => {
  it('writes a SHA-256 digest and TTL into the user row, returns plaintext token', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    const token = await assignPasswordResetToken('u1');
    const user = fakeUsers.get('u1');
    expect(user?.password_reset_token_hash).toBe(hashPasswordResetToken(token));
    expect(user?.password_reset_token_hash).not.toBe(token);
    expect(user?.password_reset_expires_at).toBeInstanceOf(Date);
    const ttlMs = user!.password_reset_expires_at!.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan((PASSWORD_RESET_TTL_MINUTES - 1) * 60_000);
    expect(ttlMs).toBeLessThanOrEqual(PASSWORD_RESET_TTL_MINUTES * 60_000);
  });
});

describe('findActiveResetTokenOwner', () => {
  it('returns null when the token does not exist', async () => {
    expect(await findActiveResetTokenOwner('nope')).toBeNull();
  });

  it('returns the user when the token is fresh and active', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    const token = await assignPasswordResetToken('u1');
    const owner = await findActiveResetTokenOwner(token);
    expect(owner?.id).toBe('u1');
  });

  it('rejects an expired token', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    const token = await assignPasswordResetToken('u1');
    jest.advanceTimersByTime((PASSWORD_RESET_TTL_MINUTES + 1) * 60_000);
    expect(await findActiveResetTokenOwner(token)).toBeNull();
  });

  it('rejects a token for a disabled user', async () => {
    const user = seedUser({ id: 'u1', email: 'a@b.c' });
    const token = await assignPasswordResetToken('u1');
    user.is_active = false;
    expect(await findActiveResetTokenOwner(token)).toBeNull();
  });
});

describe('applyPasswordResetForUser', () => {
  it('replaces the password hash and clears all reset columns', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    await assignPasswordResetToken('u1');

    await applyPasswordResetForUser('u1', 'BrandNewPassword123!');

    const user = fakeUsers.get('u1');
    expect(user?.password_reset_token_hash).toBeNull();
    expect(user?.password_reset_expires_at).toBeNull();
    expect(user?.password_reset_requested_at).toBeNull();
    expect(user?.password_hash).toBeTruthy();
    expect(await bcrypt.compare('BrandNewPassword123!', user!.password_hash!)).toBe(true);
  });

  it('makes a previously-issued token unusable (single-use)', async () => {
    seedUser({ id: 'u1', email: 'a@b.c' });
    const token = await assignPasswordResetToken('u1');
    await applyPasswordResetForUser('u1', 'AnotherSecurePass1');

    const ownerAfter = await findActiveResetTokenOwner(token);
    expect(ownerAfter).toBeNull();
  });
});
