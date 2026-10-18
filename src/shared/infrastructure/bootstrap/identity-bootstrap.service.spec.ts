import { PostgresDatabase } from '../database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from '../../../../test/helpers/postgres-test-database.js';
import { PostgresRoleRepository } from '../../../modules/roles/infrastructure/adapters/persistence/postgres-role.repository.js';
import { PostgresUserRepository } from '../../../modules/users/infrastructure/adapters/persistence/postgres-user.repository.js';
import { User } from '../../../modules/users/domain/user.entity.js';
import { Role } from '../../../modules/roles/domain/role.entity.js';
import { allPermissionKeys } from '../../security/permissions.js';
import { PasswordHasher } from '../../security/password-hasher.js';
import {
  ADMIN_EMAIL_ENV,
  ADMIN_PASSWORD_ENV,
  DENTIST_PERMISSIONS,
  IdentityBootstrapService,
} from './identity-bootstrap.service.js';

describe('IdentityBootstrapService', () => {
  let database: PostgresDatabase;
  let users: PostgresUserRepository;
  let roles: PostgresRoleRepository;
  let service: IdentityBootstrapService;

  const previousAdminEmail = process.env[ADMIN_EMAIL_ENV];
  const previousAdminPassword = process.env[ADMIN_PASSWORD_ENV];

  beforeEach(async () => {
    database = await createPostgresTestDatabase();
    users = new PostgresUserRepository(database);
    roles = new PostgresRoleRepository(database);
    service = new IdentityBootstrapService(database, users, roles, new PasswordHasher());

    process.env[ADMIN_EMAIL_ENV] = 'chief@test.local';
    process.env[ADMIN_PASSWORD_ENV] = 'Adm1n-Secret!';
  });

  afterEach(async () => {
    await closePostgresTestDatabase(database);

    if (previousAdminEmail === undefined) {
      delete process.env[ADMIN_EMAIL_ENV];
    } else {
      process.env[ADMIN_EMAIL_ENV] = previousAdminEmail;
    }

    if (previousAdminPassword === undefined) {
      delete process.env[ADMIN_PASSWORD_ENV];
    } else {
      process.env[ADMIN_PASSWORD_ENV] = previousAdminPassword;
    }
  });

  it('creates the built-in admin role synced with the whole catalog', async () => {
    await service.onApplicationBootstrap();

    const admin = await roles.findByName('admin');

    expect(admin).not.toBeNull();
    expect(admin?.builtIn).toBe(true);
    expect(admin?.isProtected).toBe(true);
    expect([...(admin?.permissions ?? [])]).toEqual([...allPermissionKeys()]);
  });

  it('re-syncs the admin role on later boots when the catalog grew', async () => {
    await service.onApplicationBootstrap();

    // Simulate a role saved by an older version of the catalog.
    const admin = (await roles.findByName('admin'))!;
    admin.changePermissions(['users:read']);
    await roles.update(admin);

    await service.onApplicationBootstrap();

    const synced = (await roles.findByName('admin'))!;
    expect([...synced.permissions]).toEqual([...allPermissionKeys()]);
  });

  it('seeds the built-in dentist role once and respects later admin edits', async () => {
    // Simulate a database from before the seed-once migration: an incomplete
    // dentist role, as the old ensure-on-boot behaviour would have left it.
    const stripped = Role.create({
      name: 'dentista',
      description: 'Dentist role pre-migration',
      permissions: ['agenda:read'],
      builtIn: true,
    });
    await roles.save(stripped);

    await service.onApplicationBootstrap();

    const migrated = (await roles.findByName('dentista'))!;
    expect(migrated.builtIn).toBe(true);

    // The one-time migration completes the default permissions...
    for (const key of DENTIST_PERMISSIONS) {
      expect(migrated.permissions).toContain(key);
    }

    // ...then the administrator edits the role...
    const removed = DENTIST_PERMISSIONS[0]!;
    migrated.changePermissions(migrated.permissions.filter((key) => key !== removed));
    await roles.update(migrated);

    // ...and later boots respect the edit instead of re-adding defaults.
    await service.onApplicationBootstrap();

    const edited = (await roles.findByName('dentista'))!;
    expect(edited.permissions).not.toContain(removed);
  });

  it('seeds editor and viewer once and assigns viewer to users without roles', async () => {
    const ada = User.create({ email: 'ada@example.com', name: 'Ada' });
    await users.save(ada);

    await service.onApplicationBootstrap();

    const viewer = await roles.findByName('viewer');
    const editor = await roles.findByName('editor');

    expect(viewer).not.toBeNull();
    expect(editor).not.toBeNull();
    expect(viewer?.builtIn).toBe(false);
    await expect(users.listUserIdsWithoutRoles()).resolves.toEqual([]);

    // The marker makes the seed a one-shot: deleting the roles later sticks.
    await roles.delete(viewer!.id);
    await service.onApplicationBootstrap();
    await expect(roles.findByName('viewer')).resolves.toBeNull();
  });

  it('creates the administrator account with credentials and the admin role', async () => {
    await service.onApplicationBootstrap();

    const admin = await users.findByEmail('chief@test.local');

    expect(admin).not.toBeNull();
    expect(admin?.hasPassword).toBe(true);
    expect(admin?.status).toBe('active');
    await expect(users.existsActiveAdmin()).resolves.toBe(true);
  });

  it('respects an existing active administrator and does not create another', async () => {
    await service.onApplicationBootstrap();
    const firstAdmin = await users.findByEmail('chief@test.local');

    process.env[ADMIN_EMAIL_ENV] = 'other@test.local';
    await service.onApplicationBootstrap();

    await expect(users.findByEmail('other@test.local')).resolves.toBeNull();
    expect(await users.findByEmail('chief@test.local')).toMatchObject({ id: firstAdmin?.id });
  });

  it('resurrects a disabled administrator (lockout rescue)', async () => {
    await service.onApplicationBootstrap();
    const admin = (await users.findByEmail('chief@test.local'))!;

    admin.changeStatus('disabled');
    await users.update(admin);

    await service.onApplicationBootstrap();

    await expect(users.existsActiveAdmin()).resolves.toBe(true);
  });

  it('is idempotent across boots', async () => {
    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    await expect(roles.findAll()).resolves.toHaveLength(4);
    await expect(users.findAll()).resolves.toHaveLength(1);
  });
});
