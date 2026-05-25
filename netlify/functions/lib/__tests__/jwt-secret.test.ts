describe('getJwtSecret', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = env;
  });

  it('throws when JWT_SECRET is missing', async () => {
    const { getJwtSecret } = await import('../jwt');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is required/);
  });

  it('throws when JWT_SECRET is an empty string', async () => {
    process.env.JWT_SECRET = '';
    const { getJwtSecret } = await import('../jwt');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is required/);
  });

  it('throws when JWT_SECRET is whitespace-only', async () => {
    process.env.JWT_SECRET = '   \t  ';
    const { getJwtSecret } = await import('../jwt');
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET is required/);
  });

  it('returns the trimmed secret when set', async () => {
    process.env.JWT_SECRET = '  a-very-long-and-random-jwt-secret-value  ';
    const { getJwtSecret } = await import('../jwt');
    expect(getJwtSecret()).toBe('a-very-long-and-random-jwt-secret-value');
  });

  it('warns about short secrets in production but does not throw', async () => {
    process.env.JWT_SECRET = 'short';
    process.env.NODE_ENV = 'production';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getJwtSecret } = await import('../jwt');
    expect(getJwtSecret()).toBe('short');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/shorter than/i));

    warn.mockRestore();
  });

  it('does not warn about short secrets outside production', async () => {
    process.env.JWT_SECRET = 'short';
    process.env.NODE_ENV = 'development';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { getJwtSecret } = await import('../jwt');
    expect(getJwtSecret()).toBe('short');
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('caches the secret (validation runs once per process)', async () => {
    process.env.JWT_SECRET = 'cached-secret-value-with-enough-length-32+';
    const { getJwtSecret } = await import('../jwt');

    expect(getJwtSecret()).toBe('cached-secret-value-with-enough-length-32+');

    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).not.toThrow();
    expect(getJwtSecret()).toBe('cached-secret-value-with-enough-length-32+');
  });
});

describe('generateToken / verifyToken integration', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    delete process.env.JWT_SECRET;
  });

  afterAll(() => {
    process.env = env;
  });

  it('throws on generateToken when JWT_SECRET is missing', async () => {
    const { generateToken } = await import('../jwt');
    expect(() => generateToken('u1', 'u1@example.com')).toThrow(/JWT_SECRET is required/);
  });

  it('round-trips a token when JWT_SECRET is set', async () => {
    process.env.JWT_SECRET = 'test-secret-with-sufficient-entropy-32+chars';
    const { generateToken, verifyToken } = await import('../jwt');

    const token = generateToken('u1', 'u1@example.com', 'user', 'artist');
    const payload = verifyToken(token);

    expect(payload).toMatchObject({
      userId: 'u1',
      email: 'u1@example.com',
      role: 'user',
      accountType: 'artist',
    });
  });
});
