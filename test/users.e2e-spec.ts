import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

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

  describe('POST /users', () => {
    it('creates a user and returns 201', async () => {
      const response = await createUser().expect(201);

      expect(response.body).toMatchObject({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.createdAt).toEqual(expect.any(String));
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
  });
});
