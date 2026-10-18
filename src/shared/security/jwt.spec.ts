import { JwtService } from './jwt.js';

describe('JwtService', () => {
  const service = new JwtService();

  it('signs and verifies an access token round-trip', () => {
    const token = service.signAccessToken('user-1', 900);
    const claims = service.verifyAccessToken(token);

    expect(claims).toMatchObject({ sub: 'user-1' });
    expect(claims!.exp - claims!.iat).toBe(900);
  });

  it('rejects a token with a tampered payload', () => {
    const token = service.signAccessToken('user-1', 900);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'admin', iat: 0, exp: 9_999_999_999 }),
      'utf8',
    ).toString('base64url');

    expect(service.verifyAccessToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it('rejects a token with a tampered signature', () => {
    const token = service.signAccessToken('user-1', 900);

    expect(service.verifyAccessToken(`${token}x`)).toBeNull();
  });

  it('rejects garbage, missing parts and empty strings', () => {
    expect(service.verifyAccessToken('')).toBeNull();
    expect(service.verifyAccessToken('a.b')).toBeNull();
    expect(service.verifyAccessToken('not.a.token')).toBeNull();
  });

  it('rejects an expired token', () => {
    const past = new Date(Date.now() - 3600 * 1000);
    const token = service.signAccessToken('user-1', 60, past);

    expect(service.verifyAccessToken(token)).toBeNull();
  });
});

describe('JwtService production secret hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('refuses to start in production without JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => new JwtService()).toThrow(/must be set in production/);
  });

  it('refuses to start in production with the development secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'hexa-dev-secret-do-not-use-in-production';

    expect(() => new JwtService()).toThrow(/too weak/);
  });

  it('refuses to start in production with a short secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short';

    expect(() => new JwtService()).toThrow(/too weak/);
  });

  it('accepts a strong secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(48);

    expect(() => new JwtService()).not.toThrow();
  });

  it('keeps the development fallback outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;

    expect(() => new JwtService()).not.toThrow();
  });
});
