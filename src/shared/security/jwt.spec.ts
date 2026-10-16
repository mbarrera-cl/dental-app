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
