import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { User } from '../../../../users/domain/user.entity.js';
import { SqliteUserRepository } from '../../../../users/infrastructure/adapters/persistence/sqlite-user.repository.js';
import { Role } from '../../../domain/role.entity.js';
import { RoleNameTakenError, RoleNotFoundError } from '../../../domain/role.errors.js';
import { SqliteRoleRepository } from './sqlite-role.repository.js';

describe('SqliteRoleRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteRoleRepository;
  let users: SqliteUserRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteRoleRepository(database);
    users = new SqliteUserRepository(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  const makeRole = (name = 'Support', permissions: string[] = ['users:read']) =>
    Role.create({ name, description: 'Desk', permissions });

  it('saves a role and reconstitutes it', async () => {
    const role = makeRole();

    await repository.save(role);
    const found = await repository.findById(role.id);

    expect(found?.role.id).toBe(role.id);
    expect(found?.role.name).toBe('Support');
    expect(found?.role.description).toBe('Desk');
    expect(found?.role.permissions).toEqual(['users:read']);
    expect(found?.role.createdAt).toEqual(role.createdAt);
    expect(found?.userCount).toBe(0);
  });

  it('translates unique violations into RoleNameTakenError (case-insensitive)', async () => {
    await repository.save(makeRole('Support'));

    await expect(repository.save(makeRole('support'))).rejects.toThrow(RoleNameTakenError);
  });

  it('finds roles by name ignoring case', async () => {
    await repository.save(makeRole('Support'));

    await expect(repository.findByName('SUPPORT')).resolves.toMatchObject({ name: 'Support' });
    await expect(repository.findByName('nope')).resolves.toBeNull();
  });

  it('updates roles and reports missing ones', async () => {
    const role = makeRole();
    await repository.save(role);

    role.rename('Support L2');
    role.changePermissions(['users:read', 'users:update']);
    await repository.update(role);

    const found = await repository.findById(role.id);
    expect(found?.role.name).toBe('Support L2');
    expect(found?.role.permissions).toEqual(['users:read', 'users:update']);

    const ghost = makeRole('Ghost');
    await expect(repository.update(ghost)).rejects.toThrow(RoleNotFoundError);
    await expect(repository.delete(ghost.id)).rejects.toThrow(RoleNotFoundError);
  });

  it('lists built-in roles first, then by name, with usage counts', async () => {
    const admin = Role.create({ name: 'admin', permissions: [], builtIn: true });
    const viewer = makeRole('viewer');
    const editor = makeRole('editor');
    await repository.save(viewer);
    await repository.save(admin);
    await repository.save(editor);

    const user = User.create({ email: 'ada@example.com', name: 'Ada' });
    await users.save(user);
    await users.assignRoleToUsers(viewer.id, [user.id]);

    const all = await repository.findAll();

    expect(all.map(({ role }) => role.name)).toEqual(['admin', 'editor', 'viewer']);
    expect(all.map(({ userCount }) => userCount)).toEqual([0, 0, 1]);
    await expect(repository.countAssignedUsers(viewer.id)).resolves.toBe(1);
  });

  it('cascades assignments when a role is deleted', async () => {
    const role = makeRole();
    await repository.save(role);
    const user = User.create({ email: 'ada@example.com', name: 'Ada' });
    await users.save(user);
    await users.assignRoleToUsers(role.id, [user.id]);

    await repository.delete(role.id);

    const assignments = database.connection
      .prepare('SELECT COUNT(*) AS count FROM user_roles WHERE role_id = ?')
      .get(role.id) as unknown as { count: number };

    expect(assignments.count).toBe(0);
  });
});
