/**
 * Unit-тесты для централизованной валидации ENCRYPTION_KEY и
 * encrypt/decrypt roundtrip в netlify/functions/lib/crypto.ts.
 *
 * Используем `jest.isolateModulesAsync` для пер-теста-чистого модуля
 * (cache внутри `crypto.ts` сбрасывается вместе с модулем).
 */

describe('getEncryptionKey', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.ENCRYPTION_KEY;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = env;
  });

  it('throws when ENCRYPTION_KEY is missing', async () => {
    const { getEncryptionKey } = await import('../crypto');
    expect(() => getEncryptionKey()).toThrow(/ENCRYPTION_KEY is required/);
  });

  it('throws when ENCRYPTION_KEY is an empty string', async () => {
    process.env.ENCRYPTION_KEY = '';
    const { getEncryptionKey } = await import('../crypto');
    expect(() => getEncryptionKey()).toThrow(/ENCRYPTION_KEY is required/);
  });

  it('throws when ENCRYPTION_KEY is whitespace-only', async () => {
    process.env.ENCRYPTION_KEY = '   \t  \n';
    const { getEncryptionKey } = await import('../crypto');
    expect(() => getEncryptionKey()).toThrow(/ENCRYPTION_KEY is required/);
  });

  it('trims surrounding whitespace before deriving the key', async () => {
    // 44 символа в base64, заканчивается на `=`, плюс пробелы вокруг.
    const base64Key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    process.env.ENCRYPTION_KEY = `  ${base64Key}  `;

    const { getEncryptionKey } = await import('../crypto');
    const derived = getEncryptionKey();

    expect(derived).toBeInstanceOf(Buffer);
    expect(derived).toHaveLength(32);
    expect(derived.equals(Buffer.from(base64Key, 'base64'))).toBe(true);
  });

  it('warns about short ENCRYPTION_KEY in production but does not throw', async () => {
    process.env.ENCRYPTION_KEY = 'short-key';
    process.env.NODE_ENV = 'production';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getEncryptionKey } = await import('../crypto');
    expect(() => getEncryptionKey()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/shorter than/i));

    warn.mockRestore();
  });

  it('does not warn about short ENCRYPTION_KEY outside production', async () => {
    process.env.ENCRYPTION_KEY = 'short-key';
    process.env.NODE_ENV = 'development';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getEncryptionKey } = await import('../crypto');
    expect(() => getEncryptionKey()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('caches the derived key (validation runs once per process)', async () => {
    process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const { getEncryptionKey } = await import('../crypto');

    const first = getEncryptionKey();

    delete process.env.ENCRYPTION_KEY;
    const second = getEncryptionKey();

    expect(second).toBe(first);
    expect(() => getEncryptionKey()).not.toThrow();
  });

  it('decodes a 44-char base64 key ending in "="', async () => {
    const raw = Buffer.alloc(32, 7);
    const base64 = raw.toString('base64');
    expect(base64).toHaveLength(44);
    expect(base64.endsWith('=')).toBe(true);
    process.env.ENCRYPTION_KEY = base64;

    const { getEncryptionKey } = await import('../crypto');
    const derived = getEncryptionKey();

    expect(derived.equals(raw)).toBe(true);
  });

  it('decodes a 64-char hex key', async () => {
    const raw = Buffer.alloc(32, 9);
    const hex = raw.toString('hex');
    expect(hex).toHaveLength(64);
    process.env.ENCRYPTION_KEY = hex;

    const { getEncryptionKey } = await import('../crypto');
    const derived = getEncryptionKey();

    expect(derived.equals(raw)).toBe(true);
  });

  it('falls back to scryptSync derivation for arbitrary strings', async () => {
    process.env.ENCRYPTION_KEY = 'some-passphrase-not-base64-not-hex';

    const { getEncryptionKey } = await import('../crypto');
    const derived = getEncryptionKey();

    expect(derived).toBeInstanceOf(Buffer);
    expect(derived).toHaveLength(32);
  });
});

describe('isEncryptionKeyConfigured', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.ENCRYPTION_KEY;
  });

  afterAll(() => {
    process.env = env;
  });

  it('returns false when ENCRYPTION_KEY is missing', async () => {
    const { isEncryptionKeyConfigured } = await import('../crypto');
    expect(isEncryptionKeyConfigured()).toBe(false);
  });

  it('returns false when ENCRYPTION_KEY is whitespace-only', async () => {
    process.env.ENCRYPTION_KEY = '   ';
    const { isEncryptionKeyConfigured } = await import('../crypto');
    expect(isEncryptionKeyConfigured()).toBe(false);
  });

  it('returns true when ENCRYPTION_KEY is set', async () => {
    process.env.ENCRYPTION_KEY = 'some-non-empty-value';
    const { isEncryptionKeyConfigured } = await import('../crypto');
    expect(isEncryptionKeyConfigured()).toBe(true);
  });

  it('does not throw and does not cache (read on every call)', async () => {
    const { isEncryptionKeyConfigured } = await import('../crypto');
    expect(isEncryptionKeyConfigured()).toBe(false);

    process.env.ENCRYPTION_KEY = 'now-it-is-set';
    expect(isEncryptionKeyConfigured()).toBe(true);
  });
});

describe('encrypt / decrypt integration', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.ENCRYPTION_KEY;
  });

  afterAll(() => {
    process.env = env;
  });

  it('throws on encrypt when ENCRYPTION_KEY is missing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { encrypt } = await import('../crypto');
    expect(() => encrypt('hello')).toThrow(/ENCRYPTION_KEY is required/);
    errorSpy.mockRestore();
  });

  it('throws on decrypt when ENCRYPTION_KEY is missing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { decrypt } = await import('../crypto');
    expect(() => decrypt('not-real-cipher-text')).toThrow(/ENCRYPTION_KEY is required/);
    errorSpy.mockRestore();
  });

  it('roundtrips text with a base64 ENCRYPTION_KEY', async () => {
    process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const { encrypt, decrypt } = await import('../crypto');

    const plaintext = 'yookassa-seller-secret-key-value-123';
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(typeof ciphertext).toBe('string');
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('roundtrips text with a hex ENCRYPTION_KEY', async () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('hex');
    const { encrypt, decrypt } = await import('../crypto');

    const plaintext = 'another secret';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('roundtrips text with a scrypt-derived ENCRYPTION_KEY (passphrase mode)', async () => {
    process.env.ENCRYPTION_KEY = 'arbitrary-passphrase-of-any-length';
    const { encrypt, decrypt } = await import('../crypto');

    const plaintext = 'roundtrip via scrypt';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces a different ciphertext for the same plaintext on every call (IV randomness)', async () => {
    process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const { encrypt, decrypt } = await import('../crypto');

    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);

    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('rejects empty plaintext on encrypt', async () => {
    process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const { encrypt } = await import('../crypto');
    expect(() => encrypt('')).toThrow(/cannot be empty/i);
  });

  it('rejects empty ciphertext on decrypt', async () => {
    process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const { decrypt } = await import('../crypto');
    expect(() => decrypt('')).toThrow(/cannot be empty/i);
  });
});
