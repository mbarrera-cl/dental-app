import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

/**
 * API keys end to end: self-service lifecycle (`apikeys:self`), cross-user
 * administration (`apikeys:read` / `apikeys:manage`), scope intersection and
 * authentication through the `X-Api-Key` header.
 */
describe('API keys (e2e)', () => {
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

  const createKey = (payload: object, token: string = authorization) =>
    request(app.getHttpServer())
      .post('/apikeys')
      .set('Authorization', token)
      .send(payload);

  const listKeys = (query = '', token: string = authorization) =>
    request(app.getHttpServer())
      .get(`/apikeys${query}`)
      .set('Authorization', token);

  /** Creates a user with `permissions` as direct grants; returns id + bearer token. */
  const createUserWithPermissions = async (
    email: string,
    permissions: string[],
  ): Promise<{ id: string; token: string }> => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({ email, name: 'Regular User', password: 'User-Pass-123!' })
      .expect(201);

    const id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .put(`/users/${id}/permissions`)
      .set('Authorization', authorization)
      .send({ permissions })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'User-Pass-123!' })
      .expect(200);

    return { id, token: `Bearer ${(login.body as { accessToken: string }).accessToken}` };
  };

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/apikeys').expect(401);
    await request(app.getHttpServer()).post('/apikeys').send({ name: 'x' }).expect(401);
  });

  it('runs the full lifecycle: create, use, rotate, revoke', async () => {
    const created = await createKey({ name: 'CI pipeline' }).expect(201);
    const { id, key, prefix } = created.body as { id: string; key: string; prefix: string };

    expect(key.startsWith(`${prefix}_`)).toBe(true);
    expect(created.body.scopes).toBeNull();

    // Lists never expose the secret again.
    const listed = await listKeys().expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(id);
    expect(listed.body[0].key).toBeUndefined();

    // The key authenticates as the admin (full permissions) via X-Api-Key.
    await request(app.getHttpServer()).get('/permissions').set('X-Api-Key', key).expect(200);
    await request(app.getHttpServer()).get('/users').set('X-Api-Key', key).expect(200);

    // last_used_at is recorded on use.
    const afterUse = await listKeys().expect(200);
    expect(afterUse.body[0].lastUsedAt).not.toBeNull();

    // Rotation keeps identity and scopes but replaces the secret.
    const rotated = await request(app.getHttpServer())
      .post(`/apikeys/${id}/rotate`)
      .set('Authorization', authorization)
      .expect(200);

    expect(rotated.body.id).toBe(id);
    expect(rotated.body.key).not.toBe(key);
    await request(app.getHttpServer()).get('/permissions').set('X-Api-Key', key).expect(401);
    await request(app.getHttpServer())
      .get('/permissions')
      .set('X-Api-Key', rotated.body.key as string)
      .expect(200);

    // Revocation is forever; revoking or rotating twice is a conflict.
    await request(app.getHttpServer())
      .delete(`/apikeys/${id}`)
      .set('Authorization', authorization)
      .expect(204);
    await request(app.getHttpServer())
      .get('/permissions')
      .set('X-Api-Key', rotated.body.key as string)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/apikeys/${id}`)
      .set('Authorization', authorization)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/apikeys/${id}/rotate`)
      .set('Authorization', authorization)
      .expect(409);
  });

  it('scopes a key down and rejects unknown or unheld scopes', async () => {
    const scoped = await createKey({ name: 'Read only', scopes: ['dashboard:read'] }).expect(201);
    const scopedKey = (scoped.body as { key: string }).key;

    // `users:read` is outside the scope even though the admin holds it.
    await request(app.getHttpServer()).get('/users').set('X-Api-Key', scopedKey).expect(403);
    // Any authenticated route still works: the key is valid, just narrow.
    await request(app.getHttpServer()).get('/permissions').set('X-Api-Key', scopedKey).expect(200);

    await createKey({ name: 'Typo', scopes: ['ghost:read'] }).expect(400);

    // A user without `users:read` cannot grant it through a key.
    const { token } = await createUserWithPermissions('regular@e2e.local', ['apikeys:self']);
    await createKey({ name: 'Too much', scopes: ['users:read'] }, token).expect(400);
  });

  it('applies owner changes instantly: disabling the owner kills the key', async () => {
    const { id, token } = await createUserWithPermissions('owner@e2e.local', ['apikeys:self']);

    const created = await createKey({ name: 'Own key' }, token).expect(201);
    const key = (created.body as { key: string }).key;

    await request(app.getHttpServer()).get('/permissions').set('X-Api-Key', key).expect(200);

    await request(app.getHttpServer())
      .patch(`/users/${id}`)
      .set('Authorization', authorization)
      .send({ status: 'disabled' })
      .expect(200);

    await request(app.getHttpServer()).get('/permissions').set('X-Api-Key', key).expect(401);
  });

  it('regular users manage only their own keys', async () => {
    const adminKey = await createKey({ name: 'Admin key' }).expect(201);
    const { id: userId, token } = await createUserWithPermissions('self@e2e.local', ['apikeys:self']);

    // Own key: allowed end to end.
    const own = await createKey({ name: 'Mine' }, token).expect(201);
    const ownId = (own.body as { id: string }).id;
    await listKeys('', token).expect(200);
    await request(app.getHttpServer())
      .post(`/apikeys/${ownId}/rotate`)
      .set('Authorization', token)
      .expect(200);

    // Someone else's data: forbidden.
    await listKeys('?all=true', token).expect(403);
    await createKey({ name: 'For admin', userId: 'admin-id' }, token).expect(403);
    await request(app.getHttpServer())
      .delete(`/apikeys/${(adminKey.body as { id: string }).id}`)
      .set('Authorization', token)
      .expect(403);

    // Admins (apikeys:manage) act on behalf of the user.
    const onBehalf = await createKey({ name: 'For user', userId }, authorization).expect(201);
    const behalfId = (onBehalf.body as { id: string }).id;
    await listKeys(`?userId=${userId}`).expect(200);
    await request(app.getHttpServer())
      .post(`/apikeys/${behalfId}/rotate`)
      .set('Authorization', authorization)
      .expect(200);
  });

  it('enforces the configured maximum of active keys per user', async () => {
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', authorization)
      .send({ values: { 'apiKeys.maxKeysPerUser': 1 } })
      .expect(200);

    await createKey({ name: 'First' }).expect(201);
    await createKey({ name: 'Second' }).expect(409);
  });

  it('never authenticates expired keys', async () => {
    const created = await createKey({ name: 'Short lived', expiresInDays: 1 }).expect(201);
    const { id, key } = created.body as { id: string; key: string };

    // Fast-forward: the row expires in the past.
    database.connection
      .prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?')
      .run('2020-01-01T00:00:00.000Z', id);

    await request(app.getHttpServer()).get('/permissions').set('X-Api-Key', key).expect(401);
  });

  it('lists every key for administrators and filters by user', async () => {
    const { id: userId } = await createUserWithPermissions('filter@e2e.local', ['apikeys:self']);

    await createKey({ name: 'Admin own' }).expect(201);
    await createKey({ name: 'On behalf', userId }, authorization).expect(201);

    const all = await listKeys('?all=true').expect(200);
    expect(all.body).toHaveLength(2);

    const filtered = await listKeys(`?userId=${userId}`).expect(200);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].name).toBe('On behalf');

    const own = await listKeys().expect(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].name).toBe('Admin own');
  });
});
