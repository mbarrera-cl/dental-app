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
  clearE2eAdminCredentials,
  loginAsAdmin,
  useE2eAdminCredentials,
} from './helpers/auth.js';

interface SettingBody {
  key: string;
  value: string | number | boolean;
}

interface AuditBody {
  at: string;
  actorType: string;
  actorEmail: string | null;
  changes: Array<{ key: string; from: string | number | boolean | null; to: string | number | boolean }>;
}

interface ExportBody {
  app: string;
  version: number;
  exportedAt: string;
  values: Record<string, string | number | boolean>;
}

/**
 * Configuration transfer and trail end to end: the export envelope, the
 * import round-trip (validated, all-or-nothing), the audit records with the
 * actor email resolved at read time, and the permission gates.
 */
describe('Settings export, import and audit (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  /** `Bearer <access token>` of the bootstrap administrator. */
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

  const patchSettings = (values: Record<string, unknown>, token = authorization) =>
    request(app.getHttpServer()).patch('/settings').set('Authorization', token).send({ values });

  const getExport = (token = authorization) =>
    request(app.getHttpServer()).get('/settings/export').set('Authorization', token);

  const postImport = (body: unknown, token = authorization) =>
    request(app.getHttpServer()).post('/settings/import').set('Authorization', token).send(body);

  const getAudit = (token = authorization, query = '?limit=10') =>
    request(app.getHttpServer()).get(`/settings/audit${query}`).set('Authorization', token);

  const getSettings = (token = authorization) =>
    request(app.getHttpServer()).get('/settings').set('Authorization', token);

  /** Creates a user with `permissions` as direct grants; returns its bearer token. */
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

  it('audits a patch with the actor email and the effective diff', async () => {
    await patchSettings({ 'clinic.name': 'Clínica E2E' }).expect(200);

    const entries = (await getAudit().expect(200)).body as AuditBody[];

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorType: 'user',
      actorEmail: E2E_ADMIN_EMAIL,
      changes: [{ key: 'clinic.name', from: 'Mi clínica', to: 'Clínica E2E' }],
    });
    expect(Number.isNaN(Date.parse(entries[0]!.at))).toBe(false);
  });

  it('drops no-op patches from the trail', async () => {
    await patchSettings({ 'clinic.name': 'Clínica E2E' }).expect(200);
    await patchSettings({ 'clinic.name': 'Clínica E2E' }).expect(200);

    const entries = (await getAudit().expect(200)).body as AuditBody[];

    expect(entries).toHaveLength(1);
  });

  it('exports the editable configuration without managed keys', async () => {
    const body = (await getExport().expect(200)).body as ExportBody;

    expect(body.app).toBe('hexa');
    expect(body.version).toBe(1);
    expect(Number.isNaN(Date.parse(body.exportedAt))).toBe(false);
    expect(body.values['clinic.name']).toBe('Mi clínica');
    expect(body.values['clinic.theme.primary']).toBe('#0284c7');
    expect(body.values).not.toHaveProperty('clinic.logo.version');
  });

  it('imports an exported envelope and audits the round-trip', async () => {
    const exported = (await getExport().expect(200)).body as ExportBody;

    exported.values['clinic.name'] = 'Clínica Importada';
    exported.values['clinic.contact.email'] = 'contacto@importada.cl';

    const overview = (await postImport(exported).expect(201)).body as SettingBody[];
    const byKey = new Map(overview.map((setting) => [setting.key, setting.value]));

    expect(byKey.get('clinic.name')).toBe('Clínica Importada');
    expect(byKey.get('clinic.contact.email')).toBe('contacto@importada.cl');

    const fresh = (await getSettings().expect(200)).body as SettingBody[];
    expect(fresh.find((setting) => setting.key === 'clinic.name')?.value).toBe('Clínica Importada');

    const entries = (await getAudit().expect(200)).body as AuditBody[];
    expect(entries[0]!.changes).toEqual([
      { key: 'clinic.name', from: 'Mi clínica', to: 'Clínica Importada' },
      { key: 'clinic.contact.email', from: '', to: 'contacto@importada.cl' },
    ]);
  });

  it('rejects malformed envelopes, unknown keys and managed keys', async () => {
    await postImport({}).expect(400);
    await postImport({ values: 'nope' }).expect(400);
    await postImport({ app: 'otra', values: {} }).expect(400);
    await postImport({ values: { 'nope.key': 1 } }).expect(400);
    await postImport({ values: { 'clinic.name': 'Válido', 'clinic.logo.version': 99 } }).expect(400);

    // All-or-nothing: the valid half of the rejected import never landed.
    const overview = (await getSettings().expect(200)).body as SettingBody[];
    expect(overview.find((setting) => setting.key === 'clinic.name')?.value).toBe('Mi clínica');
    const audit = (await getAudit().expect(200)).body as AuditBody[];
    expect(audit).toHaveLength(0);
  });

  it('requires the settings permissions for the transfer endpoints', async () => {
    const viewer = await createUserWithPermissions('settings-viewer@e2e.local', [
      'settings:read',
    ]);
    const outsider = await createUserWithPermissions('settings-outside@e2e.local', [
      'patients:read',
    ]);

    await getExport(viewer).expect(200);
    await getAudit(viewer).expect(200);
    await postImport({ values: { 'clinic.name': 'No' } }, viewer).expect(403);

    await getExport(outsider).expect(403);
    await getAudit(outsider).expect(403);
    await postImport({ values: {} }, outsider).expect(403);
    await patchSettings({ 'clinic.name': 'No' }, outsider).expect(403);
  });
});
