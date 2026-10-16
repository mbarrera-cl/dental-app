import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { PERMISSION_CATEGORIES, allPermissionKeys } from './../src/shared/security/permissions.js';
import {
  E2E_ADMIN_EMAIL,
  clearE2eAdminCredentials,
  loginAsAdmin,
  useE2eAdminCredentials,
} from './helpers/auth.js';

describe('Identity bootstrap, roles and settings API (e2e)', () => {
  let app: INestApplication<App>;
  let database: SqliteDatabase;
  /** `Bearer <access token>` of the bootstrap administrator. */
  let authorization: string;

  beforeEach(async () => {
    useE2eAdminCredentials();

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

  describe('authentication', () => {
    it('requires a valid token on protected routes', async () => {
      const response = await request(app.getHttpServer()).get('/users').expect(401);

      expect(response.body).toMatchObject({ error: 'AuthenticationRequiredError' });
    });

    it('rejects a wrong password with the generic error', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: E2E_ADMIN_EMAIL, password: 'wrong-password' })
        .expect(401);

      expect(response.body).toMatchObject({ error: 'InvalidCredentialsError' });
    });
  });

  describe('bootstrap', () => {
    it('creates the administrator account with credentials', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', authorization)
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: E2E_ADMIN_EMAIL, name: 'Administrator' }),
        ]),
      );
    });

    it('seeds the protected admin role synced with the whole catalog', async () => {
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', authorization)
        .expect(200);

      const admin = response.body.find((role: { name: string }) => role.name === 'admin');

      expect(admin).toMatchObject({ builtIn: true, userCount: 1 });
      expect([...admin.permissions].sort((a, b) => a.localeCompare(b))).toEqual(
        [...allPermissionKeys()].sort((a, b) => a.localeCompare(b)),
      );
    });

    it('seeds the editor and viewer roles', async () => {
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', authorization)
        .expect(200);

      const names = response.body.map((role: { name: string }) => role.name);
      expect(names).toEqual(expect.arrayContaining(['admin', 'editor', 'viewer']));
    });
  });

  describe('GET /permissions', () => {
    it('returns the catalog grouped by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', authorization)
        .expect(200);

      expect(response.body.categories).toHaveLength(PERMISSION_CATEGORIES.length);
      expect(response.body.categories[0]).toMatchObject({ id: 'users' });

      const keys = response.body.categories.flatMap(
        (category: { permissions: Array<{ key: string }> }) =>
          category.permissions.map((permission) => permission.key),
      );
      expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual(
        [...allPermissionKeys()].sort((a, b) => a.localeCompare(b)),
      );
    });
  });

  describe('roles CRUD', () => {
    const validRole = {
      name: 'support',
      description: 'First-level support',
      permissions: ['users:read', 'dashboard:read'],
    };

    it('creates, updates and deletes a role', async () => {
      const created = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', authorization)
        .send(validRole)
        .expect(201);

      expect(created.body).toMatchObject({
        name: 'support',
        description: 'First-level support',
        builtIn: false,
        userCount: 0,
      });

      const updated = await request(app.getHttpServer())
        .patch(`/roles/${created.body.id}`)
        .set('Authorization', authorization)
        .send({ permissions: ['users:read', 'users:update'] })
        .expect(200);

      expect(updated.body.permissions).toEqual(['users:read', 'users:update']);

      await request(app.getHttpServer())
        .delete(`/roles/${created.body.id}`)
        .set('Authorization', authorization)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/roles/${created.body.id}`)
        .set('Authorization', authorization)
        .expect(404);
    });

    it('rejects unknown permission keys with details', async () => {
      const response = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', authorization)
        .send({ ...validRole, permissions: ['users:read', 'nope:do'] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'PermissionUnknownError',
        details: { unknown: ['nope:do'] },
      });
    });

    it('rejects duplicate names case-insensitively', async () => {
      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', authorization)
        .send(validRole)
        .expect(201);

      await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', authorization)
        .send({ ...validRole, name: 'Support' })
        .expect(409);
    });

    it('protects the built-in admin role from rename and delete', async () => {
      const roles = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', authorization)
        .expect(200);

      const admin = roles.body.find((role: { name: string }) => role.name === 'admin');

      await request(app.getHttpServer())
        .patch(`/roles/${admin.id}`)
        .set('Authorization', authorization)
        .send({ name: 'superadmin' })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/roles/${admin.id}`)
        .set('Authorization', authorization)
        .expect(400);
    });

    it('reports the number of users each role is assigned to', async () => {
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', authorization)
        .expect(200);

      const admin = response.body.find((role: { name: string }) => role.name === 'admin');
      const viewer = response.body.find((role: { name: string }) => role.name === 'viewer');

      expect(admin.userCount).toBe(1);
      expect(viewer.userCount).toBe(0);
    });
  });

  describe('settings', () => {
    it('returns every setting with its default value and metadata', async () => {
      const response = await request(app.getHttpServer())
        .get('/settings')
        .set('Authorization', authorization)
        .expect(200);

      const minLength = response.body.find(
        (setting: { key: string }) => setting.key === 'passwordPolicy.minLength',
      );

      expect(minLength).toMatchObject({ value: 8, default: 8, type: 'number', group: 'passwordPolicy' });
    });

    it('updates settings and returns the fresh overview', async () => {
      const response = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', authorization)
        .send({ values: { 'passwordPolicy.minLength': 12 } })
        .expect(200);

      const minLength = response.body.find(
        (setting: { key: string }) => setting.key === 'passwordPolicy.minLength',
      );

      expect(minLength).toMatchObject({ value: 12, default: 8 });
    });

    it('rejects unknown keys and invalid values with details', async () => {
      const unknown = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', authorization)
        .send({ values: { 'nope.thing': 1 } })
        .expect(400);

      expect(unknown.body).toMatchObject({
        error: 'SettingsUnknownKeyError',
        details: { keys: ['nope.thing'] },
      });

      const invalid = await request(app.getHttpServer())
        .patch('/settings')
        .set('Authorization', authorization)
        .send({ values: { 'passwordPolicy.minLength': 2 } })
        .expect(400);

      expect(invalid.body).toMatchObject({
        error: 'SettingsValueInvalidError',
        details: { problems: [{ key: 'passwordPolicy.minLength', reason: 'must be >= 6' }] },
      });
    });
  });
});
