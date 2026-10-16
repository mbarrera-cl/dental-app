import { PermissionResolver } from './permission-resolver.js';
import { UserAccessReaderPort, type UserAccess } from './user-access.reader.port.js';

class FakeAccessReader extends UserAccessReaderPort {
  access: UserAccess | null = null;

  async load(): Promise<UserAccess | null> {
    return this.access;
  }
}

describe('PermissionResolver', () => {
  let reader: FakeAccessReader;
  let resolver: PermissionResolver;

  beforeEach(() => {
    reader = new FakeAccessReader();
    resolver = new PermissionResolver(reader);
  });

  it('returns null when the user does not exist', async () => {
    reader.access = null;

    await expect(resolver.describe('ghost')).resolves.toBeNull();
    await expect(resolver.resolveUser('ghost')).resolves.toBeNull();
  });

  it('unions role and direct permissions without duplicates', async () => {
    reader.access = {
      status: 'active',
      roles: [{ id: 'r1', name: 'viewer' }],
      rolePermissions: ['users:read', 'dashboard:read'],
      directPermissions: ['users:read', 'roles:read'],
    };

    const breakdown = await resolver.describe('user-1');

    expect(breakdown).toEqual({
      roles: [{ id: 'r1', name: 'viewer' }],
      fromRoles: ['users:read', 'dashboard:read'],
      direct: ['users:read', 'roles:read'],
      effective: ['users:read', 'dashboard:read', 'roles:read'],
    });
  });

  it('drops keys that no longer exist in the catalog', async () => {
    reader.access = {
      status: 'active',
      roles: [],
      rolePermissions: ['users:read', 'legacy:ghost'],
      directPermissions: [],
    };

    const principal = await resolver.resolveUser('user-1');

    expect([...principal!.permissions]).toEqual(['users:read']);
  });

  it('refuses to build a principal for a disabled user', async () => {
    reader.access = {
      status: 'disabled',
      roles: [],
      rolePermissions: [],
      directPermissions: [],
    };

    await expect(resolver.resolveUser('user-1')).resolves.toBeNull();
  });
});
