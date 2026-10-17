import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import {
  clearE2eAdminCredentials,
  loginAsAdmin,
  useE2eAdminCredentials,
} from './helpers/auth.js';

interface QuoteBody {
  id: string;
  folio: string;
  patientId: string;
  patientName: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  version: number;
  items: Array<{ id: string; description: string; netAmount: number; status: string }>;
}

/**
 * Quotations API end to end: create (with folio + server totals), update,
 * per-item decisions, sanction, duplicate, delete and the permission gates.
 */
describe('Quotes API (e2e)', () => {
  let app: INestApplication<App>;
  let database: SqliteDatabase;
  let authorization: string;
  let patientId: string;

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

    const patient = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', authorization)
      .send({
        rut: '12.345.678-5',
        nombres: 'Camila',
        apellidoPaterno: 'Rojas',
        apellidoMaterno: 'Pérez',
        fechaNacimiento: '1990-05-17',
        sexo: 'femenino',
      })
      .expect(201);

    patientId = (patient.body as { id: string }).id;
  });

  afterEach(async () => {
    await app.close();
    database.onModuleDestroy();
    clearE2eAdminCredentials();
  });

  const list = (token = authorization, query = '') =>
    request(app.getHttpServer()).get(`/quotes${query}`).set('Authorization', token);

  const createQuote = (body: unknown, token = authorization) =>
    request(app.getHttpServer()).post('/quotes').set('Authorization', token).send(body);

  const updateQuote = (id: string, body: unknown, token = authorization) =>
    request(app.getHttpServer()).put(`/quotes/${id}`).set('Authorization', token).send(body);

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

  const validQuote = () => ({
    patientId,
    items: [
      { description: 'Obturación de una superficie', quantity: 1, unitPrice: 4000 },
      { description: 'Endodoncia de molar', quantity: 1, unitPrice: 10000, discountPercent: 10 },
    ],
  });

  it('creates a draft quote with a folio and server-recomputed totals', async () => {
    const body = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    expect(body.status).toBe('borrador');
    expect(body.folio).toMatch(/^COT-\d{4}-\d{4}$/);
    expect(body.patientName).toBe('Camila Rojas Pérez');
    expect(body.subtotal).toBe(14000);
    expect(body.discountTotal).toBe(1000);
    expect(body.total).toBe(13000);
    expect(body.version).toBe(1);
    expect(body.items).toHaveLength(2);
  });

  it('lists quotes filtered by patient and by folio text', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    const byPatient = (await list(authorization, `?patientId=${patientId}`).expect(200)).body as QuoteBody[];
    expect(byPatient).toHaveLength(1);

    const byFolio = (await list(authorization, `?q=${created.folio}`).expect(200)).body as QuoteBody[];
    expect(byFolio).toHaveLength(1);

    const byStatus = (await list(authorization, '?status=borrador').expect(200)).body as QuoteBody[];
    expect(byStatus).toHaveLength(1);
  });

  it('updates a quote, recomputing totals and bumping the version', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    const updated = (await updateQuote(created.id, {
      items: [
        { description: 'Corona unitaria', quantity: 1, unitPrice: 15000 },
        { description: 'Sellante', quantity: 2, unitPrice: 800 },
      ],
    }).expect(200)).body as QuoteBody;

    expect(updated.items).toHaveLength(2);
    expect(updated.subtotal).toBe(16600);
    expect(updated.version).toBe(2);
  });

  it('decides an item and tracks the approved total', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;
    const itemId = created.items[0]!.id;

    const decided = (await request(app.getHttpServer())
      .patch(`/quotes/${created.id}/items/${itemId}/status`)
      .set('Authorization', authorization)
      .send({ status: 'aprobado' })
      .expect(200)).body as QuoteBody;

    const approved = decided.items.find((item) => item.id === itemId);
    expect(approved?.status).toBe('aprobado');
  });

  it('sanctions a quote (approve) and locks it', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    const sanctioned = (await request(app.getHttpServer())
      .patch(`/quotes/${created.id}/status`)
      .set('Authorization', authorization)
      .send({ status: 'aprobada' })
      .expect(200)).body as QuoteBody;

    expect(sanctioned.status).toBe('aprobada');

    // A sanctioned quote cannot be edited (it is locked: 423).
    await updateQuote(created.id, {
      items: [{ description: 'Otra cosa', quantity: 1, unitPrice: 1 }],
    }).expect(423);
  });

  it('duplicates a quote into a new draft referencing the source', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    const duplicate = (await request(app.getHttpServer())
      .post(`/quotes/${created.id}/duplicate`)
      .set('Authorization', authorization)
      .expect(201)).body as QuoteBody;

    expect(duplicate.id).not.toBe(created.id);
    expect(duplicate.status).toBe('borrador');
    expect(duplicate.folio).not.toBe(created.folio);
    expect(duplicate.items).toHaveLength(2);
  });

  it('deletes only draft quotes', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    await request(app.getHttpServer())
      .delete(`/quotes/${created.id}`)
      .set('Authorization', authorization)
      .expect(204);

    const remaining = (await list().expect(200)).body as QuoteBody[];
    expect(remaining).toHaveLength(0);
  });

  it('exposes the version trail', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;
    await updateQuote(created.id, {
      items: [{ description: 'Corona', quantity: 1, unitPrice: 15000 }],
    }).expect(200);

    const versions = (await request(app.getHttpServer())
      .get(`/quotes/${created.id}/versions`)
      .set('Authorization', authorization)
      .expect(200)).body as Array<{ action: string; version: number }>;

    expect(versions.map((v) => v.action)).toEqual(['created', 'updated']);
  });

  it('requires quotes permissions per operation', async () => {
    const reader = await createUserWithPermissions('quote-reader@e2e.local', ['quotes:read']);
    const outsider = await createUserWithPermissions('quote-outside@e2e.local', ['patients:read']);

    await list(reader).expect(200);
    await createQuote(validQuote(), reader).expect(403);
    await request(app.getHttpServer()).patch(`/quotes/any/status`).set('Authorization', reader).send({ status: 'aprobada' }).expect(403);

    await list(outsider).expect(403);
    await createQuote(validQuote(), outsider).expect(403);
  });
});
