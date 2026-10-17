import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  clearE2eAdminCredentials,
  refreshCookieOf,
  useE2eAdminCredentials,
} from './helpers/auth.js';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;

  beforeEach(async () => {
    useE2eAdminCredentials();

    database = await createPostgresTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PostgresDatabase)
      .useValue(database)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
  });

  const login = (password: string = E2E_ADMIN_PASSWORD) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: E2E_ADMIN_EMAIL, password });

  describe('POST /auth/login', () => {
    it('signs in, returns the profile and sets an httpOnly refresh cookie', async () => {
      const response = await login().expect(200);

      expect(response.body).toMatchObject({
        user: { email: E2E_ADMIN_EMAIL, name: 'Administrator' },
        expiresIn: 900,
      });
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.roles).toEqual([expect.objectContaining({ name: 'admin' })]);
      expect(response.body.permissions.effective).toEqual(
        expect.arrayContaining(['users:read', 'roles:update', 'settings:update']),
      );

      const cookie = refreshCookieOf(response);
      expect(cookie).toMatch(/^hexa_refresh=/);
      expect(response.headers['set-cookie']?.[0]).toMatch(/HttpOnly/i);
      expect(response.headers['set-cookie']?.[0]).toMatch(/Path=\/auth/i);
    });

    it('rejects a wrong password with the generic error', async () => {
      const response = await login('definitely-wrong').expect(401);

      expect(response.body).toMatchObject({ error: 'InvalidCredentialsError' });
    });

    it('rejects unknown emails with the same generic error', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'Whatever123!' })
        .expect(401);

      expect(response.body).toMatchObject({ error: 'InvalidCredentialsError' });
    });

    it('locks the account after the configured failed attempts', async () => {
      // Default policy: 5 failed attempts.
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await login('wrong-password').expect(401);
      }

      const locked = await login('wrong-password').expect(423);
      expect(locked.body).toMatchObject({
        error: 'AccountLockedError',
        details: { lockedUntil: expect.any(String) },
      });

      // Even the right password is rejected while locked.
      const stillLocked = await login().expect(423);
      expect(stillLocked.body).toMatchObject({ error: 'AccountLockedError' });
    });
  });

  describe('GET /auth/me', () => {
    it('returns the profile of the token owner', async () => {
      const session = await login().expect(200);

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${session.body.accessToken as string}`)
        .expect(200);

      expect(response.body).toMatchObject({
        user: { email: E2E_ADMIN_EMAIL },
        roles: [expect.objectContaining({ name: 'admin' })],
      });
      expect(response.body.permissions.fromRoles).toEqual(
        expect.arrayContaining(['users:read']),
      );
      expect(response.body.permissions.effective).toEqual(
        expect.arrayContaining(response.body.permissions.fromRoles),
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and returns a new session', async () => {
      const first = await login().expect(200);
      const firstCookie = refreshCookieOf(first);

      const rotated = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', firstCookie)
        .expect(200);

      expect(rotated.body.accessToken).toEqual(expect.any(String));
      const rotatedCookie = refreshCookieOf(rotated);
      expect(rotatedCookie).not.toBe(firstCookie);

      // The fresh cookie keeps working.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', rotatedCookie)
        .expect(200);
    });

    it('tolerates a concurrent replay within the grace window', async () => {
      const session = await login().expect(200);
      const cookie = refreshCookieOf(session);

      await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(200);

      // A second tab replaying the previous token moments later is fine.
      await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(200);
    });

    it('rejects a missing or unknown refresh token', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'hexa_refresh=not-a-real-token')
        .expect(401);

      expect(response.body).toMatchObject({ error: 'InvalidRefreshTokenError' });
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie and kills the session', async () => {
      const session = await login().expect(200);
      const cookie = refreshCookieOf(session);

      const logout = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(204);

      expect(logout.headers['set-cookie']?.[0]).toMatch(/^hexa_refresh=;/);

      await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
    });
  });

  describe('POST /auth/change-password', () => {
    const newPassword = 'Brand-New-456!';

    it('validates the current password', async () => {
      const session = await login().expect(200);

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${session.body.accessToken as string}`)
        .send({ currentPassword: 'wrong-current', newPassword })
        .expect(401);

      expect(response.body).toMatchObject({ error: 'InvalidCredentialsError' });
    });

    it('enforces the configured password policy with details', async () => {
      const session = await login().expect(200);

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${session.body.accessToken as string}`)
        .send({ currentPassword: E2E_ADMIN_PASSWORD, newPassword: 'short' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'PasswordPolicyViolationError',
        details: {
          violations: expect.arrayContaining([
            expect.objectContaining({ rule: 'minLength' }),
          ]),
        },
      });
    });

    it('changes the password, revokes other sessions and returns a fresh pair', async () => {
      const session = await login().expect(200);
      const oldCookie = refreshCookieOf(session);

      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${session.body.accessToken as string}`)
        .send({ currentPassword: E2E_ADMIN_PASSWORD, newPassword })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      refreshCookieOf(response);

      // Previous refresh sessions are dead.
      await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', oldCookie).expect(401);

      // Old password no longer works; the new one does.
      await login(E2E_ADMIN_PASSWORD).expect(401);
      await login(newPassword).expect(200);
    });
  });

  describe('POST /auth/change-expired-password', () => {
    it('changes the password of an unexpired account and signs the user in', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/change-expired-password')
        .send({
          email: E2E_ADMIN_EMAIL,
          currentPassword: E2E_ADMIN_PASSWORD,
          newPassword: 'Rotated-789!',
        })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      refreshCookieOf(response);

      await login('Rotated-789!').expect(200);
      await login(E2E_ADMIN_PASSWORD).expect(401);
    });

    it('rejects wrong current credentials with the generic error', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/change-expired-password')
        .send({
          email: E2E_ADMIN_EMAIL,
          currentPassword: 'wrong-current',
          newPassword: 'Rotated-789!',
        })
        .expect(401);

      expect(response.body).toMatchObject({ error: 'InvalidCredentialsError' });
    });
  });
});
