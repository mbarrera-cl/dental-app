import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

interface ActivityItem {
  id: string;
  at: string;
  actor: { id: string | null; type: string; name: string | null; email: string | null };
  action: string;
  module: string;
  subject: { type: string | null; id: string | null; label: string | null };
  outcome: 'success' | 'failure';
  statusCode: number | null;
  method: string;
  path: string;
}

interface ActivityPage {
  config: { enabled: boolean; panelLimit: number; refreshSeconds: number; badge: boolean };
  items: ActivityItem[];
  nextCursor: string | null;
}

describe('Activity API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;

  const patient = {
    rut: '11.111.111-1',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
  };

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

  async function listActivity(auth = authorization, query = ''): Promise<ActivityPage> {
    const response = await request(app.getHttpServer())
      .get(`/activity${query}`)
      .set('Authorization', auth)
      .expect(200);

    return response.body as ActivityPage;
  }

  it('records a mutating action with actor, time and subject', async () => {
    const created = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(201);

    const page = await listActivity();
    const entry = page.items.find((item) => item.action === 'patients.create');

    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      module: 'patients',
      outcome: 'success',
      statusCode: 201,
      method: 'POST',
      path: '/patients',
      subject: { type: 'patient', id: null, label: 'Camila Rojas' },
      actor: { id: expect.any(String), type: 'user', email: 'admin@e2e.local' },
    });
    expect(Number.isNaN(Date.parse(entry?.at ?? ''))).toBe(false);
    expect(created.body.id).toEqual(expect.any(String));
    expect(page.config).toEqual({
      enabled: true,
      panelLimit: 20,
      refreshSeconds: 60,
      badge: true,
    });
  });

  it('does not record ordinary reads', async () => {
    const before = (await listActivity()).items.length;

    await request(app.getHttpServer())
      .get('/patients')
      .set('Authorization', authorization)
      .expect(200);

    expect((await listActivity()).items.length).toBe(before);
  });

  it('records rejected mutations as failures', async () => {
    await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(201);

    await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(409);

    const failures = (await listActivity()).items.filter(
      (item) => item.action === 'patients.create' && item.outcome === 'failure',
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]?.statusCode).toBe(409);
  });

  it('records who opens a clinical record', async () => {
    const created = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/patients/${created.body.id}/clinical-record`)
      .set('Authorization', authorization)
      .expect(404);

    const entry = (await listActivity()).items.find(
      (item) => item.action === 'clinical.read' && item.outcome === 'failure',
    );

    expect(entry).toMatchObject({
      module: 'clinical',
      subject: { type: 'patient', id: created.body.id },
    });
  });

  it('scopes the trail to the caller without activity:read-all', async () => {
    const adminMe = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', authorization)
      .expect(200);
    const adminId = (adminMe.body as { user: { id: string } }).user.id;

    await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(201);

    const role = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', authorization)
      .send({ name: 'activity-reader', permissions: ['activity:read'] })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        email: 'reader@e2e.local',
        name: 'Reader',
        password: 'Reader-123!',
        roles: [(role.body as { id: string }).id],
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'reader@e2e.local', password: 'Reader-123!' })
      .expect(200);
    const readerAuth = `Bearer ${(login.body as { accessToken: string }).accessToken}`;

    const page = await listActivity(readerAuth, `?actorId=${adminId}`);

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => item.actor.email === 'reader@e2e.local')).toBe(true);
    expect(page.items.some((item) => item.action === 'patients.create')).toBe(false);
  });

  it('restricts purge to activity:purge and keeps its own audit entry', async () => {
    await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(201);

    const role = await request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', authorization)
      .send({ name: 'activity-viewer', permissions: ['activity:read'] })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        email: 'viewer@e2e.local',
        name: 'Viewer',
        password: 'Viewer-123!',
        roles: [(role.body as { id: string }).id],
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'viewer@e2e.local', password: 'Viewer-123!' })
      .expect(200);
    const viewerAuth = `Bearer ${(login.body as { accessToken: string }).accessToken}`;

    await request(app.getHttpServer())
      .post('/activity/purge')
      .set('Authorization', viewerAuth)
      .send({ all: true })
      .expect(403);

    const before = new Date().toISOString();
    const purge = await request(app.getHttpServer())
      .post('/activity/purge')
      .set('Authorization', authorization)
      .send({ before })
      .expect(200);

    expect((purge.body as { deleted: number }).deleted).toBeGreaterThan(0);

    const page = await listActivity();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      action: 'activity.purge',
      module: 'activity',
      outcome: 'success',
    });
    expect(page.items[0]?.at >= before).toBe(true);
  });

  it('previews the purge scope', async () => {
    await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send(patient)
      .expect(201);

    const preview = await request(app.getHttpServer())
      .get('/activity/purge/preview?all=true')
      .set('Authorization', authorization)
      .expect(200);

    expect((preview.body as { count: number }).count).toBeGreaterThan(0);
  });
});
