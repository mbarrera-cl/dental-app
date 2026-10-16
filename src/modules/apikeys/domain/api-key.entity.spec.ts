import { ApiKey } from './api-key.entity.js';
import { ApiKeyAlreadyRevokedError, InvalidApiKeyNameError } from './api-key.errors.js';

const props = {
  userId: 'user-1',
  name: 'CI pipeline',
  prefix: 'hexa_ab12cd34',
  keyHash: 'a'.repeat(64),
};

describe('ApiKey', () => {
  it('creates an active key with inherited scopes and no expiry by default', () => {
    const apiKey = ApiKey.create(props);

    expect(apiKey.id).toEqual(expect.any(String));
    expect(apiKey.name).toBe('CI pipeline');
    expect(apiKey.scopes).toBeNull();
    expect(apiKey.expiresAt).toBeNull();
    expect(apiKey.lastUsedAt).toBeNull();
    expect(apiKey.revokedAt).toBeNull();
    expect(apiKey.isRevoked).toBe(false);
    expect(apiKey.isUsable(new Date())).toBe(true);
  });

  it('trims names and de-duplicates scopes', () => {
    const apiKey = ApiKey.create({
      ...props,
      name: '  Deploy  ',
      scopes: ['dashboard:read', 'dashboard:read', 'users:read'],
    });

    expect(apiKey.name).toBe('Deploy');
    expect(apiKey.scopes).toEqual(['dashboard:read', 'users:read']);
  });

  it('rejects empty and over-long names', () => {
    expect(() => ApiKey.create({ ...props, name: '   ' })).toThrow(InvalidApiKeyNameError);
    expect(() => ApiKey.create({ ...props, name: 'x'.repeat(61) })).toThrow(InvalidApiKeyNameError);
  });

  it('expires at the configured date and never when expiresAt is null', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const expired = ApiKey.create({ ...props, expiresAt: new Date('2026-10-16T11:59:59.000Z') });
    const alive = ApiKey.create({ ...props, expiresAt: new Date('2026-10-16T12:00:01.000Z') });

    expect(expired.isExpired(now)).toBe(true);
    expect(expired.isUsable(now)).toBe(false);
    expect(alive.isExpired(now)).toBe(false);
    expect(alive.isUsable(now)).toBe(true);
    expect(ApiKey.create(props).isExpired(now)).toBe(false);
  });

  it('revokes once and refuses to revoke again', () => {
    const apiKey = ApiKey.create(props);
    const now = new Date();

    apiKey.revoke(now);

    expect(apiKey.isRevoked).toBe(true);
    expect(apiKey.revokedAt).toBe(now);
    expect(apiKey.isUsable(now)).toBe(false);
    expect(() => apiKey.revoke(now)).toThrow(ApiKeyAlreadyRevokedError);
  });

  it('rotates the secret in place and refuses on revoked keys', () => {
    const apiKey = ApiKey.create(props);

    apiKey.rotateSecret('hexa_ffffffff', 'b'.repeat(64));

    expect(apiKey.prefix).toBe('hexa_ffffffff');
    expect(apiKey.keyHash).toBe('b'.repeat(64));
    expect(apiKey.name).toBe('CI pipeline');
    expect(apiKey.scopes).toBeNull();

    apiKey.revoke(new Date());
    expect(() => apiKey.rotateSecret('hexa_00000000', 'c'.repeat(64))).toThrow(
      ApiKeyAlreadyRevokedError,
    );
  });

  it('records usage with touch', () => {
    const apiKey = ApiKey.create(props);
    const now = new Date('2026-10-16T12:00:00.000Z');

    apiKey.touch(now);

    expect(apiKey.lastUsedAt).toBe(now);
  });
});
