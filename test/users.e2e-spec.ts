import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;

  const validUser = { email: 'ada@example.com', name: 'Ada Lovelace' };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('creates a user and returns 201', async () => {
      const response = await request(app.getHttpServer()).post('/users').send(validUser).expect(201);

      expect(response.body).toMatchObject({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.createdAt).toEqual(expect.any(String));
    });

    it('returns 400 for an invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email', name: 'A' })
        .expect(400);
    });

    it('returns 409 when the email is already taken', async () => {
      const server = app.getHttpServer();

      await request(server).post('/users').send(validUser).expect(201);
      await request(server)
        .post('/users')
        .send({ ...validUser, email: 'ADA@example.com' })
        .expect(409);
    });
  });

  describe('GET /users', () => {
    it('lists all users', async () => {
      const server = app.getHttpServer();

      await request(server).post('/users').send(validUser).expect(201);
      await request(server)
        .post('/users')
        .send({ email: 'grace@example.com', name: 'Grace Hopper' })
        .expect(201);

      const response = await request(server).get('/users').expect(200);

      expect(response.body).toHaveLength(2);
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
      const created = await request(app.getHttpServer())
        .post('/users')
        .send(validUser)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/users/${created.body.id}`)
        .expect(200);

      expect(response.body).toMatchObject(validUser);
    });

    it('returns 404 for an unknown id', async () => {
      await request(app.getHttpServer()).get('/users/00000000-0000-0000-0000-000000000000').expect(404);
    });
  });
});
