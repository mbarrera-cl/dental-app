import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { SqliteDatabase } from './../src/shared/infrastructure/database/sqlite-database.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

describe('Patients API (e2e)', () => {
  let app: INestApplication<App>;
  let database: SqliteDatabase;
  /** `Bearer <access token>` of the bootstrap administrator. */
  let authorization: string;

  const validPatient = {
    rut: '12.345.678-5',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
  };

  const fullPatient = {
    ...validPatient,
    email: 'camila@example.com',
    telefono: '+56 9 1234 5678',
    direccion: {
      region: 'RM',
      comuna: 'Providencia',
      calle: 'Av. Providencia',
      numero: '1234',
      departamento: 'Depto 51',
    },
    prevision: { tipo: 'FONASA', tramo: 'B' },
    contactoEmergencia: {
      nombre: 'María Pérez',
      telefono: '9 8765 4321',
      parentesco: 'Madre',
    },
    notas: 'Alergia a la penicilina',
  };

  beforeEach(async () => {
    useE2eAdminCredentials();

    // Swap the file-backed database for a fresh in-memory SQLite per test.
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

  /** Every request in this suite is authenticated as the bootstrap admin. */
  const api = () => {
    const base = request(app.getHttpServer());

    return {
      get: (url: string) => base.get(url).set('Authorization', authorization),
      post: (url: string) => base.post(url).set('Authorization', authorization),
      patch: (url: string) => base.patch(url).set('Authorization', authorization),
      delete: (url: string) => base.delete(url).set('Authorization', authorization),
    };
  };

  const createPatient = (payload: object = validPatient) =>
    api().post('/patients').send(payload);

  describe('POST /patients', () => {
    it('creates a minimal patient and returns the canonical RUT', async () => {
      const response = await createPatient().expect(201);

      expect(response.body).toMatchObject({
        rut: '12345678-5',
        nombres: 'Camila',
        apellidoPaterno: 'Rojas',
        apellidoMaterno: 'Pérez',
        fechaNacimiento: '1990-05-17',
        sexo: 'femenino',
        email: null,
        telefono: null,
        direccion: null,
        prevision: null,
        contactoEmergencia: null,
        notas: null,
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.numeroHistoria).toMatch(/^HC-\d{6}$/);
      expect(response.body.createdAt).toEqual(expect.any(String));
    });

    it('assigns sequential numeros de historia', async () => {
      const first = await createPatient().expect(201);
      const second = await createPatient({
        ...validPatient,
        rut: '22.222.222-2',
        nombres: 'Grace',
      }).expect(201);

      expect(first.body.numeroHistoria).toBe('HC-000001');
      expect(second.body.numeroHistoria).toBe('HC-000002');
    });

    it('creates a patient with every optional group, normalizing nested values', async () => {
      const response = await createPatient(fullPatient).expect(201);

      expect(response.body).toMatchObject({
        rut: '12345678-5',
        email: 'camila@example.com',
        telefono: '+56912345678',
        direccion: {
          region: 'RM',
          comuna: 'Providencia',
          calle: 'Av. Providencia',
          numero: '1234',
          departamento: 'Depto 51',
        },
        prevision: { tipo: 'FONASA', tramo: 'B', plan: null },
        contactoEmergencia: {
          nombre: 'María Pérez',
          telefono: '+56987654321',
          parentesco: 'Madre',
        },
        notas: 'Alergia a la penicilina',
      });
    });

    it('returns 400 for a RUT with a wrong check digit', async () => {
      await createPatient({ ...validPatient, rut: '12345678-9' }).expect(400);
    });

    it('returns 400 for missing or invalid required fields', async () => {
      const { apellidoMaterno: _apellidoMaterno, ...withoutApellido } =
        validPatient;

      await createPatient(withoutApellido).expect(400);
      await createPatient({ ...validPatient, sexo: 'desconocido' }).expect(400);
      await createPatient({
        ...validPatient,
        fechaNacimiento: '2999-01-01',
      }).expect(400);
      await createPatient({
        ...validPatient,
        fechaNacimiento: '17-05-1990',
      }).expect(400);
    });

    it('returns 400 for incoherent prevision invariants', async () => {
      await createPatient({
        ...validPatient,
        prevision: { tipo: 'FONASA' },
      }).expect(400);
      await createPatient({
        ...validPatient,
        prevision: { tipo: 'ISAPRE' },
      }).expect(400);
      await createPatient({
        ...validPatient,
        prevision: { tipo: 'ISAPRE', tramo: 'B', plan: 'Colmena' },
      }).expect(400);
    });

    it('returns 409 when the RUT is already taken, whatever the spelling', async () => {
      await createPatient().expect(201);
      await createPatient({
        ...validPatient,
        rut: '12345678-5',
        nombres: 'Camila Otra',
      }).expect(409);
    });
  });

  describe('GET /patients', () => {
    it('lists all patients', async () => {
      await createPatient().expect(201);
      await createPatient({
        ...validPatient,
        rut: '22222222-2',
        nombres: 'Grace',
        apellidoMaterno: 'Soto',
      }).expect(201);

      const response = await api()
        .get('/patients')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({ rut: '12345678-5' });
      expect(response.body[1]).toMatchObject({ rut: '22222222-2' });
    });
  });

  describe('GET /patients/rut/:rut', () => {
    it('finds the patient from any RUT spelling', async () => {
      await createPatient().expect(201);

      const response = await api()
        .get('/patients/rut/12.345.678-5')
        .expect(200);

      expect(response.body).toMatchObject({ rut: '12345678-5' });
    });

    it('finds the patient when the check digit is a lowercase k', async () => {
      await createPatient({ ...validPatient, rut: '1.000.005-k' }).expect(201);

      const response = await api()
        .get('/patients/rut/1000005-K')
        .expect(200);

      expect(response.body).toMatchObject({ rut: '1000005-K' });
    });

    it('returns 400 for a malformed RUT', async () => {
      await api()
        .get('/patients/rut/not-a-rut')
        .expect(400);
    });

    it('returns 404 for a valid but unknown RUT', async () => {
      await api()
        .get('/patients/rut/9999999-3')
        .expect(404);
    });
  });

  describe('GET /patients/:id', () => {
    it('returns the patient for a known id', async () => {
      const created = await createPatient().expect(201);

      const response = await api()
        .get(`/patients/${created.body.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        rut: '12345678-5',
        nombres: 'Camila',
      });
    });

    it('returns 404 for an unknown id', async () => {
      await api()
        .get('/patients/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /patients/:id', () => {
    it('updates the provided fields and returns the updated patient', async () => {
      const created = await createPatient().expect(201);

      const response = await api()
        .patch(`/patients/${created.body.id}`)
        .send({ telefono: '+56 9 1111 2222', notas: 'Control anual' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.body.id,
        telefono: '+56911112222',
        notas: 'Control anual',
        nombres: 'Camila',
      });
    });

    it('clears optional fields when null is provided', async () => {
      const created = await createPatient(fullPatient).expect(201);

      const response = await api()
        .patch(`/patients/${created.body.id}`)
        .send({ email: null, prevision: null, notas: null })
        .expect(200);

      expect(response.body).toMatchObject({
        email: null,
        prevision: null,
        notas: null,
      });
      expect(response.body.direccion).not.toBeNull();
    });

    it('returns 400 when the body contains no updatable fields', async () => {
      const created = await createPatient().expect(201);

      await api()
        .patch(`/patients/${created.body.id}`)
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid values', async () => {
      const created = await createPatient().expect(201);

      await api()
        .patch(`/patients/${created.body.id}`)
        .send({ rut: '12345678-9' })
        .expect(400);
      await api()
        .patch(`/patients/${created.body.id}`)
        .send({ telefono: '123' })
        .expect(400);
      await api()
        .patch(`/patients/${created.body.id}`)
        .send({ nombres: null })
        .expect(400);
    });

    it('returns 409 when the new RUT belongs to another patient', async () => {
      await createPatient().expect(201);
      const grace = await createPatient({
        ...validPatient,
        rut: '22222222-2',
        nombres: 'Grace',
      }).expect(201);

      await api()
        .patch(`/patients/${grace.body.id}`)
        .send({ rut: '12345678-5' })
        .expect(409);
    });

    it('returns 404 for an unknown patient', async () => {
      await api()
        .patch('/patients/does-not-exist')
        .send({ nombres: 'Ghost' })
        .expect(404);
    });
  });

  describe('DELETE /patients/:id', () => {
    it('deletes the patient and returns 204', async () => {
      const created = await createPatient().expect(201);

      await api()
        .delete(`/patients/${created.body.id}`)
        .expect(204);

      await api()
        .get(`/patients/${created.body.id}`)
        .expect(404);
    });

    it('returns 404 for an unknown patient', async () => {
      await api()
        .delete('/patients/does-not-exist')
        .expect(404);
    });

    it('refuses to delete a patient that has quotations (409)', async () => {
      const created = await createPatient().expect(201);
      const patientId = (created.body as { id: string }).id;

      await api()
        .post('/quotes')
        .send({
          patientId,
          items: [{ description: 'Consulta de control', quantity: 1, unitPrice: 3000 }],
        })
        .expect(201);

      const response = await api().delete(`/patients/${patientId}`).expect(409);

      expect((response.body as { error: string }).error).toBe('PatientHasQuotesError');

      // The patient and its quotations are still there.
      await api().get(`/patients/${patientId}`).expect(200);
    });
  });
});
