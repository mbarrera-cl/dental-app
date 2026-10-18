import { createHmac } from 'node:crypto';
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

describe('JwtService claim validation', () => {
  const secret = 'a'.repeat(48);

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });

  it('rejects a token signed by a service with a different issuer', () => {
    process.env.JWT_SECRET = secret;
    process.env.JWT_ISSUER = 'other-service';
    const foreign = new JwtService();
    const token = foreign.signAccessToken('user-1', 900);

    delete process.env.JWT_ISSUER;
    const own = new JwtService();

    expect(own.verifyAccessToken(token)).toBeNull();
  });

  it('rejects a token with a foreign audience', () => {
    process.env.JWT_SECRET = secret;
    process.env.JWT_AUDIENCE = 'another-api';
    const foreign = new JwtService();
    const token = foreign.signAccessToken('user-1', 900);

    delete process.env.JWT_AUDIENCE;
    const own = new JwtService();

    expect(own.verifyAccessToken(token)).toBeNull();
  });

  it('rejects a correctly signed token whose header is not HS256', () => {
    process.env.JWT_SECRET = secret;
    const service = new JwtService();
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        iat: now,
        exp: now + 900,
        iss: 'hexa',
        aud: 'hexa-api',
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    expect(service.verifyAccessToken(`${header}.${payload}.${signature}`)).toBeNull();
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
