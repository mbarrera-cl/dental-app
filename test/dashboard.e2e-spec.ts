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

interface DashboardBody {
  window: { today: string; monthStart: string };
  patients: {
    total: number;
    newLast30Days: number;
    prevision: Array<{ tipo: string; count: number }>;
  };
  cash: {
    outstanding: number;
    chargesMonth: number;
    collectionsToday: Array<{ method: string; total: number }>;
    collectionsMonth: Array<{ method: string; total: number }>;
    topDebtors: Array<{ patientId: string; patientName: string; balance: number }>;
  };
  quotes: {
    funnel: Record<string, number>;
    approvedMonth: number;
    conversionRate: number | null;
    expiringSoon: number;
  };
  agenda: {
    today: Array<{ status: string; count: number }>;
    cancelledMonth: number;
    totalMonth: number;
    next: Array<{ id: string; startsAt: string; patientName: string; professionalName: string }>;
  };
  recentActivity: Array<{ at: string; action: string; module: string; outcome: string }>;
}

/**
 * Dashboard read model end to end: one summary aggregating patients, cash,
 * quotes, agenda and activity, with the permission gate. Seeds every module
 * through the public API so the figures come from real records.
 */
describe('Dashboard API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;
  let patientId: string;
  let professionalId: string;

  beforeAll(() => {
    process.env.AGENDA_EMAIL_WORKER = 'false';
  });

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

    const profile = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', authorization)
      .expect(200);
    professionalId = (profile.body as { user: { id: string } }).user.id;

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
        email: 'camila@e2e.local',
      })
      .expect(201);
    patientId = (patient.body as { id: string }).id;
  });

  afterEach(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
  });

  const summary = () =>
    request(app.getHttpServer()).get('/dashboard/summary').set('Authorization', authorization);

  const seedQuoteAndPayment = async () => {
    const quote = await request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', authorization)
      .send({
        patientId,
        items: [
          { description: 'Obturación de una superficie', quantity: 1, unitPrice: 4000 },
          { description: 'Endodoncia de molar', quantity: 1, unitPrice: 10000, discountPercent: 10 },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/quotes/${(quote.body as { id: string }).id}/status`)
      .set('Authorization', authorization)
      .send({ status: 'aprobada' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/patients/${patientId}/ledger/payments`)
      .set('Authorization', authorization)
      .send({ concept: 'Abono inicial', amount: 3000, method: 'efectivo' })
      .expect(201);
  };

  const seedAppointment = async () => {
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + 1);
    startsAt.setHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(11, 0, 0, 0);

    return request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({ patientId, professionalId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason: 'Control' })
      .expect(201);
  };

  it('aggregates patients, cash, quotes, agenda and activity in one read', async () => {
    await seedQuoteAndPayment();
    await seedAppointment();

    const body = (await summary().expect(200)).body as DashboardBody;

    // One shared window.
    expect(body.window.today).toEqual(expect.any(String));
    expect(body.window.monthStart).toEqual(expect.any(String));
    expect(new Date(body.window.today).getTime()).toBeLessThanOrEqual(Date.now());

    // Patients.
    expect(body.patients.total).toBe(1);
    expect(body.patients.newLast30Days).toBe(1);
    expect(body.patients.prevision).toEqual([
      { tipo: 'FONASA', count: 0 },
      { tipo: 'ISAPRE', count: 0 },
      { tipo: 'CONVENIO', count: 0 },
      { tipo: 'PARTICULAR', count: 1 },
    ]);

    // Cash: 13.000 charged automatically on approval, 3.000 paid today.
    expect(body.cash.outstanding).toBe(10000);
    expect(body.cash.chargesMonth).toBe(13000);
    expect(body.cash.collectionsToday).toEqual([
      { method: 'efectivo', total: 3000 },
      { method: 'tarjeta', total: 0 },
      { method: 'transferencia', total: 0 },
    ]);
    expect(body.cash.collectionsMonth).toEqual(body.cash.collectionsToday);
    expect(body.cash.topDebtors).toEqual([
      { patientId, patientName: 'Camila Rojas Pérez', balance: 10000 },
    ]);

    // Quotes: the approved one plus its money.
    expect(body.quotes.funnel).toEqual({
      borrador: 0,
      sin_respuesta: 0,
      aprobada: 1,
      rechazada: 0,
    });
    expect(body.quotes.approvedMonth).toBe(13000);
    expect(body.quotes.conversionRate).toBe(1);
    expect(body.quotes.expiringSoon).toBe(0);

    // Agenda: the appointment is upcoming, nothing today.
    expect(body.agenda.totalMonth).toBeGreaterThanOrEqual(0);
    expect(body.agenda.next[0]).toMatchObject({
      patientName: 'Camila Rojas Pérez',
      professionalName: 'Administrator',
    });
    expect(Date.parse(body.agenda.next[0]!.startsAt)).not.toBeNaN();

    // Activity: writes above were recorded.
    expect(body.recentActivity.length).toBeGreaterThan(0);
    expect(body.recentActivity[0]!.at).toEqual(expect.any(String));
  });

  it('requires dashboard:read', async () => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({ email: 'dashboard-outsider@e2e.local', name: 'Outsider', password: 'User-Pass-123!' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/users/${(created.body as { id: string }).id}/permissions`)
      .set('Authorization', authorization)
      .send({ permissions: ['patients:read'] })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dashboard-outsider@e2e.local', password: 'User-Pass-123!' })
      .expect(200);
    const token = `Bearer ${(login.body as { accessToken: string }).accessToken}`;

    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', token)
      .expect(403);
  });
});
