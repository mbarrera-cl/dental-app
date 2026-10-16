import { UserAccessReaderPort, type UserAccess } from '../../../../shared/security/user-access.reader.port.js';
import { ApiKey } from '../../domain/api-key.entity.js';
import { hashApiKey } from '../../domain/api-key-secret.js';
import { InMemoryApiKeyRepository } from './persistence/in-memory-api-key.repository.js';
import { ApiKeyAuthenticatorService } from './api-key-authenticator.service.js';

class FakeUserAccessReader extends UserAccessReaderPort {
  private readonly access = new Map<string, UserAccess>();

  set(userId: string, access: UserAccess): void {
    this.access.set(userId, access);
  }

  async load(userId: string): Promise<UserAccess | null> {
    return this.access.get(userId) ?? null;
  }
}

describe('ApiKeyAuthenticatorService', () => {
  let apiKeys: InMemoryApiKeyRepository;
  let access: FakeUserAccessReader;
  let authenticator: ApiKeyAuthenticatorService;

  beforeEach(() => {
    apiKeys = new InMemoryApiKeyRepository();
    access = new FakeUserAccessReader();
    authenticator = new ApiKeyAuthenticatorService(apiKeys, access);

    access.set('user-1', {
      status: 'active',
      roles: [{ id: 'role-editor', name: 'editor' }],
      rolePermissions: ['dashboard:read', 'users:read'],
      directPermissions: ['settings:read'],
    });
  });

  const makeKey = async (
    overrides: Partial<Parameters<typeof ApiKey.create>[0]> = {},
  ): Promise<{ key: ApiKey; plain: string }> => {
    const plain = 'hexa_ab12cd34_supersecret';
    const key = ApiKey.create({
      userId: 'user-1',
      name: 'CI pipeline',
      prefix: 'hexa_ab12cd34',
      keyHash: hashApiKey(plain),
      ...overrides,
    });
    await apiKeys.save(key);

    return { key, plain };
  };

  it('authenticates a valid key as its owner, with the full effective permissions', async () => {
    const { key, plain } = await makeKey();

    const principal = await authenticator.authenticate(plain);

    expect(principal).toEqual({
      type: 'apikey',
      userId: 'user-1',
      apiKeyId: key.id,
      permissions: new Set(['dashboard:read', 'users:read', 'settings:read']),
      roles: [{ id: 'role-editor', name: 'editor' }],
    });
  });

  it('records last_used_at on every successful authentication', async () => {
    const { key, plain } = await makeKey();

    await authenticator.authenticate(plain);

    const stored = await apiKeys.findById(key.id);
    expect(stored?.lastUsedAt).not.toBeNull();
  });

  it('rejects unknown secrets without leaking why', async () => {
    await makeKey();

    await expect(authenticator.authenticate('hexa_deadbeef_nope')).resolves.toBeNull();
  });

  it('rejects revoked and expired keys', async () => {
    const revoked = await makeKey({ name: 'Revoked' });
    revoked.key.revoke(new Date());
    await apiKeys.update(revoked.key);

    const expired = await makeKey({
      name: 'Expired',
      keyHash: hashApiKey('hexa_expired_value'),
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    await expect(authenticator.authenticate(revoked.plain)).resolves.toBeNull();
    await expect(authenticator.authenticate(expired.plain)).resolves.toBeNull();
  });

  it('rejects keys whose owner is disabled or gone', async () => {
    const { plain } = await makeKey();

    access.set('user-1', {
      status: 'disabled',
      roles: [],
      rolePermissions: [],
      directPermissions: [],
    });

    await expect(authenticator.authenticate(plain)).resolves.toBeNull();

    // Simulate a deleted owner: the access reader no longer knows the user.
    access = new FakeUserAccessReader();
    authenticator = new ApiKeyAuthenticatorService(apiKeys, access);

    await expect(authenticator.authenticate(plain)).resolves.toBeNull();
  });

  it('intersects scopes with the owner permissions *on every request*', async () => {
    const { plain } = await makeKey({ scopes: ['dashboard:read', 'users:read'] });

    const first = await authenticator.authenticate(plain);
    expect(first?.permissions).toEqual(new Set(['dashboard:read', 'users:read']));

    // The owner loses a permission (role edited): the key shrinks instantly.
    access.set('user-1', {
      status: 'active',
      roles: [],
      rolePermissions: ['dashboard:read'],
      directPermissions: [],
    });

    const second = await authenticator.authenticate(plain);
    expect(second?.permissions).toEqual(new Set(['dashboard:read']));
  });

  it('never grants a scope the owner no longer holds', async () => {
    const { plain } = await makeKey({ scopes: ['settings:read'] });

    access.set('user-1', {
      status: 'active',
      roles: [],
      rolePermissions: [],
      directPermissions: [],
    });

    const principal = await authenticator.authenticate(plain);
    expect(principal?.permissions).toEqual(new Set());
  });
});
