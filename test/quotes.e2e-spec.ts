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
  deletedAt: string | null;
  deletedByName: string | null;
  sanctionedByName: string | null;
  items: Array<{ id: string; description: string; netAmount: number; status: string }>;
}

/**
 * Quotations API end to end: create (with folio + server totals), update,
 * per-item decisions, sanction, duplicate, delete and the permission gates.
 */
describe('Quotes API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;
  let patientId: string;

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
    await closePostgresTestDatabase(database);
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
        {
          id: created.items[0]!.id,
          description: 'Obturación editada',
          quantity: 1,
          unitPrice: 4000,
        },
        { description: 'Sellante', quantity: 2, unitPrice: 800 },
      ],
    }).expect(200)).body as QuoteBody;

    expect(updated.items).toHaveLength(2);
    expect(updated.items[0]?.description).toBe('Obturación editada');
    expect(updated.subtotal).toBe(5600);
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

  it('changes status through the selector and keeps an approved quote editable', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    const sanction = (status: string) =>
      request(app.getHttpServer())
        .patch(`/quotes/${created.id}/status`)
        .set('Authorization', authorization)
        .send({ status });

    expect(((await sanction('sin_respuesta').expect(200)).body as QuoteBody).status).toBe(
      'sin_respuesta',
    );
    const approved = (await sanction('aprobada').expect(200)).body as QuoteBody;
    expect(approved.status).toBe('aprobada');
    expect(approved.sanctionedByName).toBe('Administrator');

    // Editing does not silently change the explicit status.
    const edited = (await updateQuote(created.id, {
      items: [{ description: 'Otra cosa', quantity: 1, unitPrice: 1 }],
    }).expect(200)).body as QuoteBody;
    expect(edited.status).toBe('aprobada');
    expect(edited.total).toBe(1);

    expect(((await sanction('rechazada').expect(200)).body as QuoteBody).status).toBe('rechazada');
    const draft = (await sanction('borrador').expect(200)).body as QuoteBody;
    expect(draft.status).toBe('borrador');
    expect(draft.sanctionedByName).toBeNull();
  });

  it('charges the patient account once when a quote is approved and never duplicates it', async () => {
    const ledger = () =>
      request(app.getHttpServer()).get(`/patients/${patientId}/ledger`).set('Authorization', authorization);

    const cargos = async () =>
      ((await ledger().expect(200)).body as { balance: number; movements: Array<{ id: string; kind: string; amount: number; concept: string; quoteId: string | null; voidedAt: string | null }> })
        .movements.filter((movement) => movement.kind === 'cargo');

    const changeStatus = (id: string, status: string) =>
      request(app.getHttpServer())
        .patch(`/quotes/${id}/status`)
        .set('Authorization', authorization)
        .send({ status });

    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;
    expect(await cargos()).toHaveLength(0);

    const approved = ((await changeStatus(created.id, 'aprobada').expect(200)).body as QuoteBody);
    expect(approved.status).toBe('aprobada');
    // Approving the quote approves every line in a chain.
    for (const item of approved.items) {
      expect(item.status).toBe('aprobado');
    }

    const charges = await cargos();
    expect(charges).toHaveLength(1);
    expect(charges[0]!.amount).toBe(13000);
    expect(charges[0]!.quoteId).toBe(created.id);
    expect(charges[0]!.concept).toContain(created.folio);
    expect(charges[0]!.voidedAt).toBeNull();
    expect(((await ledger().expect(200)).body as { balance: number }).balance).toBe(13000);

    // Re-opening and re-approving never duplicates the charge (frozen snapshot).
    await changeStatus(created.id, 'borrador').expect(200);
    await changeStatus(created.id, 'aprobada').expect(200);
    expect(await cargos()).toHaveLength(1);

    // Rejecting another quote does not charge anything.
    const rejected = (await createQuote(validQuote()).expect(201)).body as QuoteBody;
    await changeStatus(rejected.id, 'rechazada').expect(200);
    expect(await cargos()).toHaveLength(1);
  });

  it('recharges (new amount) only through the voided-charge recovery path', async () => {
    const changeStatus = (id: string, status: string) =>
      request(app.getHttpServer())
        .patch(`/quotes/${id}/status`)
        .set('Authorization', authorization)
        .send({ status });

    const ledger = () =>
      request(app.getHttpServer()).get(`/patients/${patientId}/ledger`).set('Authorization', authorization);

    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;
    await changeStatus(created.id, 'aprobada').expect(200);

    const [charge] = ((await ledger().expect(200)).body as { movements: Array<{ id: string; kind: string }> })
      .movements.filter((movement) => movement.kind === 'cargo');

    // Editing the plan does not touch the frozen charge.
    await changeStatus(created.id, 'borrador').expect(200);
    await updateQuote(created.id, {
      items: [{ description: 'Plan corregido', quantity: 1, unitPrice: 20000 }],
    }).expect(200);
    let ledgerBody = (await ledger().expect(200)).body as { movements: Array<{ kind: string; voidedAt: string | null; amount: number }> };
    expect(ledgerBody.movements.filter((m) => m.kind === 'cargo' && m.voidedAt === null)).toHaveLength(1);
    expect(ledgerBody.balance).toBe(13000);

    // Voiding the old cargo unlocks a corrected charge on re-approval.
    await request(app.getHttpServer())
      .post(`/ledger/${charge!.id}/void`)
      .set('Authorization', authorization)
      .send({ reason: 'Monto corregido' })
      .expect(200);

    await changeStatus(created.id, 'aprobada').expect(200);

    ledgerBody = (await ledger().expect(200)).body as { movements: Array<{ kind: string; voidedAt: string | null; amount: number }> };
    const live = ledgerBody.movements.filter((m) => m.kind === 'cargo' && m.voidedAt === null);
    expect(live).toHaveLength(1);
    expect(live[0]!.amount).toBe(20000);
    expect(ledgerBody.balance).toBe(20000);
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

  it('moves a draft to the trash and restores it', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    await request(app.getHttpServer())
      .delete(`/quotes/${created.id}`)
      .set('Authorization', authorization)
      .expect(204);

    // Hidden from the active list and from the detail endpoint.
    expect((await list().expect(200)).body as QuoteBody[]).toHaveLength(0);
    await request(app.getHttpServer())
      .get(`/quotes/${created.id}`)
      .set('Authorization', authorization)
      .expect(404);

    // Visible in the trash, with its deletion metadata.
    const trash = (await list(authorization, '?deleted=only').expect(200)).body as QuoteBody[];
    expect(trash).toHaveLength(1);
    expect(trash[0]!.id).toBe(created.id);
    expect(trash[0]!.deletedAt).not.toBeNull();
    expect(trash[0]!.deletedByName).toBe('Administrator');

    // The merge view shows both.
    expect((await list(authorization, '?deleted=all').expect(200)).body as QuoteBody[]).toHaveLength(1);

    const restored = (await request(app.getHttpServer())
      .post(`/quotes/${created.id}/restore`)
      .set('Authorization', authorization)
      .expect(200)).body as QuoteBody;

    expect(restored.deletedAt).toBeNull();
    expect((await list().expect(200)).body as QuoteBody[]).toHaveLength(1);
    expect((await list(authorization, '?deleted=only').expect(200)).body as QuoteBody[]).toHaveLength(0);
  });

  it('trashes a sanctioned quote, keeps its status and restores it', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    await request(app.getHttpServer())
      .patch(`/quotes/${created.id}/status`)
      .set('Authorization', authorization)
      .send({ status: 'aprobada' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/quotes/${created.id}`)
      .set('Authorization', authorization)
      .expect(204);

    const trash = (await list(authorization, '?deleted=only').expect(200)).body as QuoteBody[];
    expect(trash[0]!.status).toBe('aprobada');

    const restored = (await request(app.getHttpServer())
      .post(`/quotes/${created.id}/restore`)
      .set('Authorization', authorization)
      .expect(200)).body as QuoteBody;

    expect(restored.status).toBe('aprobada');
    expect(restored.sanctionedByName).toBe('Administrator');
  });

  it('blocks editing, deciding, sanctioning and duplicating a trashed quote', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;
    const itemId = created.items[0]!.id;

    await request(app.getHttpServer())
      .delete(`/quotes/${created.id}`)
      .set('Authorization', authorization)
      .expect(204);

    await updateQuote(created.id, {
      items: [{ description: 'Otra', quantity: 1, unitPrice: 1 }],
    }).expect(404);

    await request(app.getHttpServer())
      .patch(`/quotes/${created.id}/items/${itemId}/status`)
      .set('Authorization', authorization)
      .send({ status: 'aprobado' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/quotes/${created.id}/status`)
      .set('Authorization', authorization)
      .send({ status: 'aprobada' })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/quotes/${created.id}/duplicate`)
      .set('Authorization', authorization)
      .expect(404);
  });

  it('records deletion and restoration in the version trail', async () => {
    const created = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    await request(app.getHttpServer())
      .delete(`/quotes/${created.id}`)
      .set('Authorization', authorization)
      .expect(204);
    await request(app.getHttpServer())
      .post(`/quotes/${created.id}/restore`)
      .set('Authorization', authorization)
      .expect(200);

    const versions = (await request(app.getHttpServer())
      .get(`/quotes/${created.id}/versions`)
      .set('Authorization', authorization)
      .expect(200)).body as Array<{ action: string }>;

    expect(versions.map((version) => version.action)).toEqual(['created', 'deleted', 'restored']);
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
    await list(reader, '?deleted=only').expect(200);
    await createQuote(validQuote(), reader).expect(403);
    await request(app.getHttpServer()).patch(`/quotes/any/status`).set('Authorization', reader).send({ status: 'aprobada' }).expect(403);

    const updater = await createUserWithPermissions('quote-updater@e2e.local', [
      'quotes:read',
      'quotes:update',
    ]);
    const approver = await createUserWithPermissions('quote-approver@e2e.local', [
      'quotes:read',
      'quotes:approve',
    ]);
    const editable = (await createQuote(validQuote()).expect(201)).body as QuoteBody;

    await request(app.getHttpServer())
      .patch(`/quotes/${editable.id}/status`)
      .set('Authorization', updater)
      .send({ status: 'sin_respuesta' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/quotes/${editable.id}/status`)
      .set('Authorization', updater)
      .send({ status: 'aprobada' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/quotes/${editable.id}/status`)
      .set('Authorization', approver)
      .send({ status: 'aprobada' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/quotes/${editable.id}/status`)
      .set('Authorization', approver)
      .send({ status: 'borrador' })
      .expect(403);

    await list(outsider).expect(403);
    await createQuote(validQuote(), outsider).expect(403);
  });
});
