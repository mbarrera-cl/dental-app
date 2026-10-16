import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { User } from '../../../domain/user.entity.js';
import { UserAlreadyExistsError, UserNotFoundError } from '../../../domain/user.errors.js';
import { SqliteUserRepository } from './sqlite-user.repository.js';

describe('SqliteUserRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteUserRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqliteUserRepository(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  const makeUser = (email = 'ada@example.com', name = 'Ada Lovelace') =>
    User.create({ email, name });

  it('saves a user and reconstitutes it from the database', async () => {
    const user = makeUser();

    await repository.save(user);
    const found = await repository.findById(user.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(user.id);
    expect(found?.email).toBe(user.email);
    expect(found?.name).toBe(user.name);
    expect(found?.createdAt).toEqual(user.createdAt);
  });

  it('translates unique constraint violations into UserAlreadyExistsError', async () => {
    await repository.save(makeUser());

    await expect(repository.save(makeUser('ada@example.com', 'Ada Again'))).rejects.toThrow(
      UserAlreadyExistsError,
    );
  });

  it('updates an existing user', async () => {
    const user = makeUser();
    await repository.save(user);

    user.changeName('Ada King');
    await repository.update(user);

    const found = await repository.findById(user.id);
    expect(found?.name).toBe('Ada King');
  });

  it('throws UserNotFoundError when updating or deleting unknown users', async () => {
    const ghost = makeUser();

    await expect(repository.update(ghost)).rejects.toThrow(UserNotFoundError);
    await expect(repository.delete(ghost.id)).rejects.toThrow(UserNotFoundError);
  });

  it('deletes a user', async () => {
    const user = makeUser();
    await repository.save(user);

    await repository.delete(user.id);

    await expect(repository.findById(user.id)).resolves.toBeNull();
  });

  it('finds by email and lists users in insertion order', async () => {
    const ada = makeUser();
    const grace = makeUser('grace@example.com', 'Grace Hopper');
    await repository.save(ada);
    await repository.save(grace);

    await expect(repository.findByEmail('grace@example.com')).resolves.toMatchObject({
      id: grace.id,
    });

    const all = await repository.findAll();
    expect(all.map((user) => user.id)).toEqual([ada.id, grace.id]);
  });

  describe('credentials and login tracking', () => {
    it('round-trips every authentication column', async () => {
      const user = makeUser();
      const changedAt = new Date('2026-02-01T00:00:00.000Z');
      const lockedUntil = new Date('2026-02-01T00:30:00.000Z');

      user.setPassword('scrypt$hash', { mustChange: true, changedAt });
      user.registerFailedLogin();
      user.lockUntil(lockedUntil);
      user.changeStatus('disabled');
      await repository.save(user);

      const found = await repository.findById(user.id);

      expect(found?.passwordHash).toBe('scrypt$hash');
      expect(found?.passwordChangedAt).toEqual(changedAt);
      expect(found?.mustChangePassword).toBe(true);
      expect(found?.failedLoginAttempts).toBe(1);
      expect(found?.lockedUntil).toEqual(lockedUntil);
      expect(found?.status).toBe('disabled');
      expect(found?.lastLoginAt).toBeNull();
    });

    it('persists a successful login through update', async () => {
      const user = makeUser();
      await repository.save(user);

      user.recordLoginSuccess(new Date('2026-03-01T10:00:00.000Z'));
      await repository.update(user);

      const found = await repository.findById(user.id);
      expect(found?.lastLoginAt).toEqual(new Date('2026-03-01T10:00:00.000Z'));
      expect(found?.failedLoginAttempts).toBe(0);
    });
  });

  describe('role assignments and administrator detection', () => {
    const insertRole = (id: string, name: string): void => {
      const now = new Date().toISOString();
      database.connection
        .prepare(
          `INSERT INTO roles (id, name, description, permissions, built_in, created_at, updated_at)
           VALUES (?, ?, '', '[]', 0, ?, ?)`,
        )
        .run(id, name, now, now);
    };

    it('detects an active administrator with credentials and the admin role', async () => {
      await expect(repository.existsActiveAdmin()).resolves.toBe(false);

      insertRole('role-admin', 'admin');
      const admin = makeUser();
      admin.setPassword('scrypt$hash', { mustChange: false });
      await repository.save(admin);
      await repository.assignRoleToUsers('role-admin', [admin.id]);

      await expect(repository.existsActiveAdmin()).resolves.toBe(true);
    });

    it('ignores disabled administrators and admins without a password', async () => {
      insertRole('role-admin', 'admin');

      const withoutPassword = makeUser();
      await repository.save(withoutPassword);
      await repository.assignRoleToUsers('role-admin', [withoutPassword.id]);

      await expect(repository.existsActiveAdmin()).resolves.toBe(false);

      withoutPassword.setPassword('scrypt$hash', { mustChange: false });
      withoutPassword.changeStatus('disabled');
      await repository.update(withoutPassword);

      await expect(repository.existsActiveAdmin()).resolves.toBe(false);
    });

    it('lists users without roles and assigns roles idempotently', async () => {
      insertRole('role-viewer', 'viewer');
      const ada = makeUser();
      const grace = makeUser('grace@example.com', 'Grace Hopper');
      await repository.save(ada);
      await repository.save(grace);

      const withoutRoles = await repository.listUserIdsWithoutRoles();

      expect(withoutRoles).toHaveLength(2);
      expect(withoutRoles).toEqual(expect.arrayContaining([ada.id, grace.id]));

      await repository.assignRoleToUsers('role-viewer', [ada.id]);
      await repository.assignRoleToUsers('role-viewer', [ada.id, grace.id]);

      await expect(repository.listUserIdsWithoutRoles()).resolves.toEqual([]);

      const assigned = database.connection
        .prepare('SELECT COUNT(*) AS count FROM user_roles WHERE role_id = ?')
        .get('role-viewer') as unknown as { count: number };
      expect(assigned.count).toBe(2);
    });
  });
});
