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

interface MovementBody {
  id: string;
  kind: 'cargo' | 'abono';
  amount: number;
  signedAmount: number;
  method: string | null;
  concept: string;
  patientId: string;
  voidedAt: string | null;
  voidReason: string | null;
}

interface LedgerBody {
  balance: number;
  movements: MovementBody[];
}

/**
 * Patient account (cobros / caja) end to end: charges, payments, the computed
 * balance, the append-only annulment, the cash summary and the permission
 * gates. Reality: integer CLP, saldo único por paciente.
 */
describe('Payments API (e2e)', () => {
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

  const charge = (body: unknown, token = authorization, id = patientId) =>
    request(app.getHttpServer())
      .post(`/patients/${id}/ledger/charges`)
      .set('Authorization', token)
      .send(body);

  const pay = (body: unknown, token = authorization, id = patientId) =>
    request(app.getHttpServer())
      .post(`/patients/${id}/ledger/payments`)
      .set('Authorization', token)
      .send(body);

  const ledger = (token = authorization, id = patientId) =>
    request(app.getHttpServer())
      .get(`/patients/${id}/ledger`)
      .set('Authorization', token);

  const voidIt = (id: string, body: unknown, token = authorization) =>
    request(app.getHttpServer())
      .post(`/ledger/${id}/void`)
      .set('Authorization', token)
      .send(body);

  const cashSummary = (query = '', token = authorization) =>
    request(app.getHttpServer()).get(`/ledger/cash-summary${query}`).set('Authorization', token);

  const getMovement = (id: string, token = authorization) =>
    request(app.getHttpServer()).get(`/ledger/${id}`).set('Authorization', token);

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

  it('records charges and payments and computes the single balance', async () => {
    await charge({ amount: 15000, concept: 'Consulta', quoteId: null }).expect(201);
    await charge({ amount: 4500, concept: 'Resina compuesta pieza 1.6' }).expect(201);

    const paid = (await pay({
      amount: 5000,
      concept: 'Abono parcial anual',
      method: 'transferencia',
      reference: 'op/42 BancoEstado',
    }).expect(201)).body as MovementBody;

    expect(paid.kind).toBe('abono');
    expect(paid.signedAmount).toBe(-5000);
    expect(paid.method).toBe('transferencia');
    expect(paid.reference).toBe('op/42 BancoEstado');

    const account = (await ledger().expect(200)).body as LedgerBody;
    expect(account.balance).toBe(14500);
    expect(account.movements).toHaveLength(3);
    // Newest first.
    expect(account.movements[0]!.kind).toBe('abono');
    expect(account.movements[2]!.concept).toBe('Consulta');
  });

  it('untouched account reads a zero balance with an empty history', async () => {
    const account = (await ledger().expect(200)).body as LedgerBody;

    expect(account.balance).toBe(0);
    expect(account.movements).toHaveLength(0);
  });

  it('validates payloads and unknown patients', async () => {
    await charge({ amount: 0, concept: 'Consulta' }).expect(400);
    await charge({ amount: -5, concept: 'Consulta' }).expect(400);
    await charge({ amount: 10.5, concept: 'Consulta' }).expect(400);
    await charge({ amount: 100, concept: '' }).expect(400);
    await charge({ amount: 100, concept: 'x'.repeat(301) }).expect(400);
    await pay({ amount: 100, concept: 'Abono', method: 'paypal' }).expect(400);
    await pay({ amount: 100, concept: 'Abono' }).expect(400);
    await charge(
      { amount: 100, concept: 'Consulta' },
      authorization,
      '00000000-0000-0000-0000-000000000000',
    ).expect(404);
  });

  it('voids a payment, keeps the row and heals the balance', async () => {
    const paid = (await pay({
      amount: 5000,
      concept: 'Abono duplicado',
      method: 'efectivo',
    }).expect(201)).body as MovementBody;

    const voided = (await voidIt(paid.id, { reason: 'pago ingresado dos veces' }).expect(200))
      .body as MovementBody;

    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidReason).toBe('pago ingresado dos veces');

    // The row stays in the book, the balance is recomputed without it.
    const account = (await ledger().expect(200)).body as LedgerBody;
    expect(account.movements).toHaveLength(1);
    expect(account.movements[0]!.voidedAt).not.toBeNull();
    expect(account.balance).toBe(0);

    // Idempotency is a conflict, not a silent no-op.
    await voidIt(paid.id, { reason: 'otra vez' }).expect(409);
    await voidIt('00000000-0000-0000-0000-000000000000', { reason: 'nadie' }).expect(404);
  });

  it('summarizes the cash per method and ignores voided payments', async () => {
    await pay({ amount: 5000, concept: 'Efectivo 1', method: 'efectivo' }).expect(201);
    await pay({ amount: 7000, concept: 'Efectivo 2', method: 'efectivo' }).expect(201);
    const card = (await pay({
      amount: 20000,
      concept: 'Con tarjeta',
      method: 'tarjeta',
      reference: 'voucher 99',
    }).expect(201)).body as MovementBody;

    await voidIt(card.id, { reason: 'venta anulada' }).expect(200);

    const summary = (await cashSummary().expect(200)).body as Array<{ method: string; total: number }>;
    expect(summary).toEqual([{ method: 'efectivo', total: 12000 }]);
  });

  it('exposes one movement by id for the printable receipt', async () => {
    const paid = (await pay({
      amount: 12000,
      concept: 'Corona',
      method: 'tarjeta',
      reference: 'voucher 77',
    }).expect(201)).body as MovementBody;

    const fetched = (await getMovement(paid.id).expect(200)).body as MovementBody;
    expect(fetched.id).toBe(paid.id);
    expect(fetched.method).toBe('tarjeta');
    expect(fetched.reference).toBe('voucher 77');
    await getMovement('00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('requires payments permissions per operation', async () => {
    const reader = await createUserWithPermissions('payment-reader@e2e.local', ['payments:read']);
    const creator = await createUserWithPermissions('payment-creator@e2e.local', [
      'payments:read',
      'payments:create',
    ]);
    const voider = await createUserWithPermissions('payment-voider@e2e.local', [
      'payments:read',
      'payments:create',
      'payments:void',
    ]);

    // Reading is fine without the create permission…
    await ledger(reader).expect(200);
    // …but recording is not.
    await charge({ amount: 100, concept: 'Consulta' }, reader).expect(403);

    await charge({ amount: 100, concept: 'Consulta' }, creator).expect(201);
    await pay({ amount: 100, concept: 'Abono', method: 'efectivo' }, creator).expect(201);

    // Annulling is its own permission, distinct from recording.
    const account = (await ledger().expect(200)).body as LedgerBody;
    const movementId = account.movements[0]!.id;
    await voidIt(movementId, { reason: 'corrección' }, creator).expect(403);

    const annulled = (await voidIt(movementId, { reason: 'corrección' }, voider).expect(200))
      .body as MovementBody;
    expect(annulled.voidedAt).not.toBeNull();

    // Nobody outside the payments world sees this API at all.
    const outsider = await createUserWithPermissions('payment-outside@e2e.local', ['users:read']);
    await ledger(outsider).expect(403);
    await cashSummary('', outsider).expect(403);
    await charge({ amount: 100, concept: 'Consulta' }, outsider).expect(403);
  });
});
