import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
import {
  clearE2eAdminCredentials,
  loginAsAdmin,
  useE2eAdminCredentials,
} from './helpers/auth.js';

interface UcoBody {
  id: string;
  code: string;
  chapter: string;
  name: string;
  units: number;
  status: 'active' | 'inactive';
}

/**
 * UCO fee catalog end to end: the seeded reference catalog, CRUD and the
 * permission gates (read vs manage).
 */
describe('UCO fee catalog (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;

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

    authorization = await loginAsAdmin(app);
  });

  afterEach(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
  });

  const list = (token = authorization, query = '') =>
    request(app.getHttpServer()).get(`/uco${query}`).set('Authorization', token);

  const create = (body: unknown, token = authorization) =>
    request(app.getHttpServer()).post('/uco').set('Authorization', token).send(body);

  const patch = (id: string, body: unknown, token = authorization) =>
    request(app.getHttpServer()).patch(`/uco/${id}`).set('Authorization', token).send(body);

  const remove = (id: string, token = authorization) =>
    request(app.getHttpServer()).delete(`/uco/${id}`).set('Authorization', token);

  const createUserWithPermissions = async (email: string, permissions: string[]): Promise<string> => {
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

    return `Bearer ${(login.body as { accessToken: string }).accessToken}`;
  };

  it('seeds the reference catalog and exposes it through GET /uco', async () => {
    const body = (await list().expect(200)).body as UcoBody[];

    expect(body.length).toBeGreaterThanOrEqual(40);
    expect(body.every((entry) => entry.status === 'active')).toBe(true);
    expect(body.find((entry) => entry.code === '010001')?.name).toBe('Consulta dental de urgencia');
  });

  it('searches by code and name, and filters active entries', async () => {
    await create({
      code: '999001',
      chapter: '9',
      name: 'Procedimiento de prueba',
      units: 2,
    }).expect(201);

    const byCode = (await list(authorization, '?q=999001').expect(200)).body as UcoBody[];
    expect(byCode).toHaveLength(1);

    const byName = (await list(authorization, '?q=Prueba').expect(200)).body as UcoBody[];
    expect(byName).toHaveLength(1);

    const activeOnly = (await list(authorization, '?active=true&q=Prueba').expect(200)).body as UcoBody[];
    expect(activeOnly).toHaveLength(1);
  });

  it('creates, updates and soft-deletes a procedure', async () => {
    const created = (await create({
      code: 'ABCD01',
      chapter: '1',
      name: 'Tratamiento X',
      units: 1.5,
    }).expect(201)).body as UcoBody;

    expect(created.code).toBe('ABCD01');
    expect(created.status).toBe('active');

    const updated = (await patch(created.id, { name: 'Tratamiento X v2', units: 2 }).expect(200)).body as UcoBody;
    expect(updated.name).toBe('Tratamiento X v2');
    expect(updated.units).toBe(2);

    await remove(created.id).expect(204);

    // Without `active=true`, search still surfaces inactive entries (they are
    // soft-deleted, kept for history). Restrict with `active=true` to hide them.
    const afterDelete = (await list(authorization, `?q=ABCD01`).expect(200)).body as UcoBody[];
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]!.status).toBe('inactive');

    const activeAfterDelete = (await list(authorization, '?active=true&q=ABCD01').expect(200)).body as UcoBody[];
    expect(activeAfterDelete).toHaveLength(0);
  });

  it('rejects a duplicate code as a conflict', async () => {
    await create({ code: '010001', chapter: '1', name: 'A', units: 1 }).expect(409);
  });

  it('requires uco:manage to mutate and uco:read to list', async () => {
    const reader = await createUserWithPermissions('uco-reader@e2e.local', ['uco:read']);
    const outsider = await createUserWithPermissions('uco-outside@e2e.local', ['patients:read']);

    await list(reader).expect(200);
    await create({ code: 'ZZZ001', chapter: '1', name: 'X', units: 1 }, reader).expect(403);
    await patch('any', { name: 'X' }, reader).expect(403);
    await remove('any', reader).expect(403);

    await list(outsider).expect(403);
    await create({ code: 'ZZZ002', chapter: '1', name: 'X', units: 1 }, outsider).expect(403);
  });
});
