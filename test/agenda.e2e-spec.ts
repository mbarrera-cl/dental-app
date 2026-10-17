import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

interface PatientBody {
  id: string;
  nombreCompleto?: string;
}

interface AppointmentBody {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  icsSequence: number;
  warnings: Array<{ id: string }>;
  patient: { id: string; email: string | null };
  professional: { id: string; email: string };
}

function validRut(body: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const digit = 11 - (sum % 11);
  return `${body}-${digit === 11 ? '0' : digit === 10 ? 'K' : digit}`;
}

describe('Agenda (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;
  let patientId: string;
  let professionalId: string;

  beforeAll(async () => {
    useE2eAdminCredentials();
    process.env.AGENDA_EMAIL_WORKER = 'false';
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
        rut: validRut('24680246'),
        nombres: 'Agenda',
        apellidoPaterno: 'Paciente',
        apellidoMaterno: 'E2E',
        fechaNacimiento: '1990-01-01',
        sexo: 'otro',
        email: 'agenda.paciente@example.com',
      })
      .expect(201);
    patientId = (patient.body as PatientBody).id;
  });

  beforeEach(async () => {
    await database.execute('DELETE FROM agenda_email_outbox');
    await database.execute('DELETE FROM appointments');
  });

  afterAll(async () => {
    await app.close();
    await closePostgresTestDatabase(database);
    clearE2eAdminCredentials();
    delete process.env.AGENDA_EMAIL_WORKER;
  });

  const futureRange = (): { startsAt: string; endsAt: string } => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    start.setSeconds(0, 0);
    return {
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
    };
  };

  it('returns agenda configuration and professionals', async () => {
    const config = await request(app.getHttpServer())
      .get('/agenda/config')
      .set('Authorization', authorization)
      .expect(200);
    expect(config.body).toMatchObject({
      timeZone: 'America/Santiago',
      defaultDurationMinutes: 30,
      notifyPatient: true,
      notifyProfessional: true,
    });

    const professionals = await request(app.getHttpServer())
      .get('/agenda/professionals')
      .set('Authorization', authorization)
      .expect(200);
    expect((professionals.body as Array<{ id: string }>).some((item) => item.id === professionalId)).toBe(true);
  });

  it('searches patients for the agenda picker without requiring the patient list endpoint', async () => {
    const search = await request(app.getHttpServer())
      .get('/agenda/patients?query=Agenda')
      .set('Authorization', authorization)
      .expect(200);
    expect((search.body as Array<{ id: string }>).some((item) => item.id === patientId)).toBe(true);

    const one = await request(app.getHttpServer())
      .get(`/agenda/patients/${patientId}`)
      .set('Authorization', authorization)
      .expect(200);
    expect(one.body).toMatchObject({ id: patientId, nombreCompleto: 'Agenda Paciente E2E' });
  });

  it('creates an appointment and queues both confirmation emails', async () => {
    const range = futureRange();
    const created = await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({ patientId, professionalId, ...range, reason: 'Control' })
      .expect(201);
    const appointment = created.body as AppointmentBody;

    expect(appointment.status).toBe('scheduled');
    expect(appointment.icsSequence).toBe(0);
    expect(appointment.warnings).toEqual([]);

    const outbox = await database.query<{ recipient_kind: string; status: string; ics: string }>(
      'SELECT recipient_kind, status, ics FROM agenda_email_outbox WHERE appointment_id = $1 ORDER BY recipient_kind',
      [appointment.id],
    );
    expect(outbox).toHaveLength(2);
    expect(outbox.map((row) => row.recipient_kind)).toEqual(['patient', 'professional']);
    expect(outbox.every((row) => row.status === 'skipped')).toBe(true);
    expect(outbox[0]?.ics).toContain('METHOD:REQUEST');
    expect(outbox[0]?.ics).toContain('SEQUENCE:0');
  });

  it('warns about overlaps without blocking creation', async () => {
    const range = futureRange();
    const first = await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({ patientId, professionalId, ...range, reason: 'Primera' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({ patientId, professionalId, ...range, reason: 'Segunda' })
      .expect(201);

    expect((second.body as AppointmentBody).warnings).toHaveLength(1);
    expect((second.body as AppointmentBody).warnings[0]?.id).toBe((first.body as AppointmentBody).id);
  });

  it('reschedules and cancels with updated ICS sequences', async () => {
    const range = futureRange();
    const created = await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({ patientId, professionalId, ...range, reason: 'Reprogramable' })
      .expect(201);
    const id = (created.body as AppointmentBody).id;
    const shifted = {
      startsAt: new Date(new Date(range.startsAt).getTime() + 60 * 60 * 1000).toISOString(),
      endsAt: new Date(new Date(range.endsAt).getTime() + 60 * 60 * 1000).toISOString(),
    };

    const updated = await request(app.getHttpServer())
      .patch(`/agenda/appointments/${id}`)
      .set('Authorization', authorization)
      .send(shifted)
      .expect(200);
    expect((updated.body as AppointmentBody).icsSequence).toBe(1);

    const cancelled = await request(app.getHttpServer())
      .post(`/agenda/appointments/${id}/cancel`)
      .set('Authorization', authorization)
      .expect(200);
    expect((cancelled.body as AppointmentBody).status).toBe('cancelled');
    expect((cancelled.body as AppointmentBody).icsSequence).toBe(2);

    const outbox = await database.query<{ event_type: string; ics: string }>(
      'SELECT event_type, ics FROM agenda_email_outbox WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 2',
      [id],
    );
    expect(outbox.every((row) => row.event_type === 'cancelled')).toBe(true);
    expect(outbox[0]?.ics).toContain('METHOD:CANCEL');
    expect(outbox[0]?.ics).toContain('SEQUENCE:2');
    expect(outbox[0]?.ics).toContain('STATUS:CANCELLED');
  });

  it('rejects invalid ranges and unknown professionals', async () => {
    const range = futureRange();
    await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({ patientId, professionalId, startsAt: range.endsAt, endsAt: range.startsAt })
      .expect(400);

    await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', authorization)
      .send({
        patientId,
        professionalId: '00000000-0000-4000-8000-000000000000',
        ...range,
      })
      .expect(400);
  });

  it('requires agenda permissions to create appointments', async () => {
    const created = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', authorization)
      .send({
        email: 'agenda-no-permission@example.com',
        name: 'No Agenda',
        password: 'No-Agenda-123!',
      })
      .expect(201);
    const userId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .put(`/users/${userId}/permissions`)
      .set('Authorization', authorization)
      .send({ permissions: ['patients:read'] })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'agenda-no-permission@example.com', password: 'No-Agenda-123!' })
      .expect(200);
    const token = `Bearer ${(login.body as { accessToken: string }).accessToken}`;
    const range = futureRange();

    await request(app.getHttpServer())
      .post('/agenda/appointments')
      .set('Authorization', token)
      .send({ patientId, professionalId, ...range })
      .expect(403);
  });
});
