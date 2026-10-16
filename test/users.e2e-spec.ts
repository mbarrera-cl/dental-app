import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import {
  E2E_ADMIN_EMAIL,
  clearE2eAdminCredentials,
  loginAsAdmin,
  useE2eAdminCredentials,
} from './helpers/auth.js';

describe('Users API (e2e)', () => {
  let app: INestApplication<App>;
  let database: SqliteDatabase;
  /** `Bearer <access token>` of the bootstrap administrator. */
  let authorization: string;

  const validUser = { email: 'ada@example.com', name: 'Ada Lovelace' };

  beforeEach(async () => {
    // Predictable bootstrap: this suite only cares about regular users.
    useE2eAdminCredentials();

    // Swap the file-backed database for a fresh in-memory SQLite per test.
    database = new SqliteDatabase(':memory:');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SqliteDatabase)
      .useValue(database)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();

    authorization = await loginAsAdmin(app);
  });

  afterEach(async () => {
    await app.close();
    database.onModuleDestroy();
    clearE2eAdminCredentials();
  });

  const createUser = (payload: object = validUser) =>
    request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send(payload);

  /** Id of a role by name, straight from the admin API. */
  const roleId = async (name: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', authorization)
      .expect(200);

    const role = (response.body as Array<{ id: string; name: string }>).find(
      (candidate) => candidate.name === name,
    );

    expect(role).toBeDefined();

    return role!.id;
  };

  const userIdByEmail = async (email: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', authorization)
      .expect(200);

    const user = (response.body as Array<{ id: string; email: string }>).find(
      (candidate) => candidate.email === email,
    );

    expect(user).toBeDefined();

    return user!.id;
  };

  describe('POST /users', () => {
    it('creates a user and returns 201', async () => {
      const response = await createUser().expect(201);

      expect(response.body).toMatchObject({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        status: 'active',
        roles: [],
        directPermissions: [],
        lastLoginAt: null,
        mustChangePassword: false,
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.createdAt).toEqual(expect.any(String));
    });

    it('creates a user with password, roles and status', async () => {
      const editor = await roleId('editor');

      const response = await createUser({
        ...validUser,
        password: 'Str0ng-Passw0rd!',
        roles: [editor],
        status: 'disabled',
      }).expect(201);

      expect(response.body).toMatchObject({ status: 'disabled' });
      expect(response.body.roles).toEqual([expect.objectContaining({ id: editor, name: 'editor' })]);
    });

    it('returns 400 when the password breaks the policy', async () => {
      const response = await createUser({ ...validUser, password: 'short' }).expect(400);

      expect(response.body.error).toBe('PasswordPolicyViolationError');
      expect(response.body.details.violations).toEqual(
        expect.arrayContaining([expect.objectContaining({ rule: 'minLength' })]),
      );
    });

    it('returns 400 when a role id is unknown', async () => {
      const response = await createUser({
        ...validUser,
        roles: ['00000000-0000-0000-0000-000000000000'],
      }).expect(400);

      expect(response.body.error).toBe('UnknownRoleError');
    });

    it('returns 400 for an invalid payload', async () => {
      await createUser({ email: 'not-an-email', name: 'A' }).expect(400);
    });

    it('returns 409 when the email is already taken', async () => {
      await createUser().expect(201);
      await createUser({ ...validUser, email: 'ADA@example.com' }).expect(409);
    });
  });

  describe('GET /users', () => {
    it('lists all users', async () => {
      await createUser().expect(201);
      await createUser({ email: 'grace@example.com', name: 'Grace Hopper' }).expect(201);

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', authorization)
        .expect(200);

      // The bootstrap administrator is present too; check the regular ones.
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'ada@example.com' }),
          expect.objectContaining({ email: 'grace@example.com' }),
        ]),
      );
    });
  });

  describe('GET /users/:id', () => {
    it('returns the user for a known id', async () => {
      const created = await createUser().expect(201);

      const response = await request(app.getHttpServer())
        .get(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .expect(200);

      expect(response.body).toMatchObject(validUser);
    });

    it('returns 404 for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authorization)
        .expect(404);
    });
  });

  describe('PATCH /users/:id', () => {
    it('updates the provided fields and returns the updated user', async () => {
      const created = await createUser().expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .send({ name: 'Ada King', email: 'ada.king@example.com' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.body.id,
        name: 'Ada King',
        email: 'ada.king@example.com',
      });
    });

    it('returns 400 when the body contains no updatable fields', async () => {
      const created = await createUser().expect(201);

      await request(app.getHttpServer())
        .patch(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .send({})
        .expect(400);
    });

    it('returns 400 for an invalid email', async () => {
      const created = await createUser().expect(201);

      await request(app.getHttpServer())
        .patch(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('returns 409 when the new email belongs to another user', async () => {
      await createUser().expect(201);
      const grace = await createUser({
        email: 'grace@example.com',
        name: 'Grace Hopper',
      }).expect(201);

      await request(app.getHttpServer())
        .patch(`/users/${grace.body.id}`)
        .set('Authorization', authorization)
        .send({ email: 'ada@example.com' })
        .expect(409);
    });

    it('returns 404 for an unknown user', async () => {
      await request(app.getHttpServer())
        .patch('/users/does-not-exist')
        .set('Authorization', authorization)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('assigns roles and disables the user', async () => {
      const editor = await roleId('editor');
      const created = await createUser().expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .send({ roles: [editor], status: 'disabled' })
        .expect(200);

      expect(response.body).toMatchObject({ status: 'disabled' });
      expect(response.body.roles).toEqual([
        expect.objectContaining({ id: editor, name: 'editor' }),
      ]);

      const cleared = await request(app.getHttpServer())
        .patch(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .send({ roles: [] })
        .expect(200);

      expect(cleared.body.roles).toEqual([]);
    });

    it('refuses to demote or disable the last active administrator (409)', async () => {
      const adminId = await userIdByEmail(E2E_ADMIN_EMAIL);

      for (const payload of [{ roles: [] }, { status: 'disabled' }]) {
        const response = await request(app.getHttpServer())
          .patch(`/users/${adminId}`)
          .set('Authorization', authorization)
          .send(payload)
          .expect(409);

        expect(response.body.error).toBe('LastAdminError');
      }
    });

    it('allows demoting an administrator once another active admin exists', async () => {
      const adminRole = await roleId('admin');
      const editor = await roleId('editor');
      await createUser({
        email: 'second-admin@example.com',
        name: 'Second Admin',
        password: 'Str0ng-Passw0rd!',
        roles: [adminRole],
      }).expect(201);

      const adminId = await userIdByEmail(E2E_ADMIN_EMAIL);
      const response = await request(app.getHttpServer())
        .patch(`/users/${adminId}`)
        .set('Authorization', authorization)
        .send({ roles: [editor] })
        .expect(200);

      expect(response.body.roles).toEqual([
        expect.objectContaining({ id: editor, name: 'editor' }),
      ]);
    });
  });

  describe('POST /users/:id/password', () => {
    const resetPassword = (id: string, payload: object) =>
      request(app.getHttpServer())
        .post(`/users/${id}/password`)
        .set('Authorization', authorization)
        .send(payload);

    it('resets a typed password, unlocks nothing extra and forces a change on login', async () => {
      const created = await createUser({
        ...validUser,
        password: 'Old-Passw0rd-123!',
      }).expect(201);

      const response = await resetPassword(created.body.id, {
        password: 'Nueva-Str0ng-456!',
      }).expect(200);

      // A typed password is never echoed back.
      expect(response.body).toEqual({});

      // The new password works, but only to change it.
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'Nueva-Str0ng-456!' })
        .expect(403);

      expect(login.body.error).toBe('PasswordChangeRequiredError');

      // The old password no longer works.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'Old-Passw0rd-123!' })
        .expect(401);
    });

    it('generates a policy-compliant password and returns it exactly once', async () => {
      const created = await createUser().expect(201);

      const response = await resetPassword(created.body.id, { generate: true }).expect(200);

      expect(response.body.password).toEqual(expect.any(String));

      const fetched = await request(app.getHttpServer())
        .get(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .expect(200);

      expect(fetched.body.mustChangePassword).toBe(true);
      expect(fetched.body).not.toHaveProperty('password');

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: response.body.password })
        .expect(403);
    });

    it('returns 400 when the password breaks the policy', async () => {
      const created = await createUser().expect(201);

      const response = await resetPassword(created.body.id, { password: 'short' }).expect(400);

      expect(response.body.error).toBe('PasswordPolicyViolationError');
    });

    it('returns 400 when the password was used recently', async () => {
      const created = await createUser({
        ...validUser,
        password: 'Repeated-Passw0rd-1!',
      }).expect(201);

      const response = await resetPassword(created.body.id, {
        password: 'Repeated-Passw0rd-1!',
      }).expect(400);

      expect(response.body.error).toBe('PasswordReusedError');
    });

    it('returns 400 when neither password nor generate is provided', async () => {
      const created = await createUser().expect(201);

      const response = await resetPassword(created.body.id, {}).expect(400);

      expect(response.body.error).toBe('EmptyPasswordResetError');
    });

    it('returns 404 for an unknown user and 401 without a token', async () => {
      await resetPassword('does-not-exist', { generate: true }).expect(404);

      await request(app.getHttpServer())
        .post('/users/does-not-exist/password')
        .send({ generate: true })
        .expect(401);
    });
  });

  describe('PUT /users/:id/permissions', () => {
    const setPermissions = (id: string, permissions: string[]) =>
      request(app.getHttpServer())
        .put(`/users/${id}/permissions`)
        .set('Authorization', authorization)
        .send({ permissions });

    it('replaces the direct permissions of a user', async () => {
      const created = await createUser().expect(201);

      const response = await setPermissions(created.body.id, [
        'users:read',
        'dashboard:read',
        'users:read',
      ]).expect(200);

      expect(response.body.directPermissions.sort()).toEqual(['dashboard:read', 'users:read']);

      const cleared = await setPermissions(created.body.id, []).expect(200);
      expect(cleared.body.directPermissions).toEqual([]);
    });

    it('returns 400 for keys outside the catalog', async () => {
      const created = await createUser().expect(201);

      const response = await setPermissions(created.body.id, ['ghost:read']).expect(400);

      expect(response.body.error).toBe('PermissionUnknownError');
      expect(response.body.details.unknown).toEqual(['ghost:read']);
    });

    it('returns 404 for an unknown user', async () => {
      await setPermissions('does-not-exist', ['users:read']).expect(404);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes the user and returns 204', async () => {
      const created = await createUser().expect(201);

      await request(app.getHttpServer())
        .delete(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/users/${created.body.id}`)
        .set('Authorization', authorization)
        .expect(404);
    });

    it('returns 404 for an unknown user', async () => {
      await request(app.getHttpServer())
        .delete('/users/does-not-exist')
        .set('Authorization', authorization)
        .expect(404);
    });

    it('refuses to delete the last active administrator (409)', async () => {
      const adminId = await userIdByEmail(E2E_ADMIN_EMAIL);

      const response = await request(app.getHttpServer())
        .delete(`/users/${adminId}`)
        .set('Authorization', authorization)
        .expect(409);

      expect(response.body.error).toBe('LastAdminError');
    });
  });
});
