import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import { closePostgresTestDatabase, createPostgresTestDatabase } from './helpers/postgres-test-database.js';
import { suggestCategoriaEtaria } from './../src/modules/clinical/domain/categoria-etaria.js';
import { clearE2eAdminCredentials, loginAsAdmin, useE2eAdminCredentials } from './helpers/auth.js';

describe('Clinical API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  /** `Bearer <access token>` of the bootstrap administrator. */
  let authorization: string;

  const validPatient = {
    rut: '12.345.678-5',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '2015-05-17',
    sexo: 'femenino',
  };

  beforeEach(async () => {
    useE2eAdminCredentials();

    // Swap the file-backed database for a fresh in-memory SQLite per test.
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

  const createPatient = async (payload: object = validPatient) => {
    const response = await api().post('/patients').send(payload).expect(201);

    return response.body as { id: string; numeroHistoria: string };
  };

  const openRecord = async (patientId: string, payload: object = {}) => {
    const response = await api()
      .post(`/patients/${patientId}/clinical-record`)
      .send(payload)
      .expect(201);

    return response.body as { id: string; categoria: string };
  };

  describe('POST /patients/:patientId/clinical-record', () => {
    it('opens the record preselecting the category for the age', async () => {
      const patient = await createPatient();

      const response = await api()
        .post(`/patients/${patient.id}/clinical-record`)
        .send({})
        .expect(201);

      expect(response.body).toMatchObject({
        patientId: patient.id,
        embarazada: false,
        status: 'borrador',
        motivoConsulta: null,
        enfermedadActual: null,
      });
      expect(response.body.categoria).toBe(
        suggestCategoriaEtaria(validPatient.fechaNacimiento),
      );
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('accepts an explicit category override (5-14 no programado)', async () => {
      const patient = await createPatient();

      const response = await api()
        .post(`/patients/${patient.id}/clinical-record`)
        .send({ categoria: '5-14-no-programado' })
        .expect(201);

      expect(response.body.categoria).toBe('5-14-no-programado');
    });

    it('rejects a second record for the same patient', async () => {
      const patient = await createPatient();
      await openRecord(patient.id);

      await api()
        .post(`/patients/${patient.id}/clinical-record`)
        .send({})
        .expect(409);
    });

    it('returns 404 for an unknown patient', async () => {
      await api()
        .post('/patients/does-not-exist/clinical-record')
        .send({})
        .expect(404);
    });
  });

  describe('GET /patients/:patientId/clinical-record', () => {
    it('returns 404 until the record is opened, then the record itself', async () => {
      const patient = await createPatient();

      await api()
        .get(`/patients/${patient.id}/clinical-record`)
        .expect(404);

      const record = await openRecord(patient.id);
      const response = await api()
        .get(`/patients/${patient.id}/clinical-record`)
        .expect(200);

      expect(response.body.id).toBe(record.id);
    });
  });

  describe('PATCH /clinical-records/:id', () => {
    it('updates the form sections of the HCU act', async () => {
      const patient = await createPatient();
      const record = await openRecord(patient.id);

      const response = await api()
        .patch(`/clinical-records/${record.id}`)
        .send({
          motivoConsulta: 'Dolor en pieza 16',
          enfermedadActual: 'Dolor agudo desde hace dos días',
          antecedentes: {
            asma: { present: true, notes: 'Inhalador a mano' },
            diabetes: { present: false },
          },
          signosVitales: {
            presionArterialSistolica: 120,
            presionArterialDiastolica: 80,
            frecuenciaCardiaca: 72,
            temperatura: 36.5,
            frecuenciaRespiratoria: 16,
          },
          examenEstomatognatico: {
            regiones: { labios: 'normal', mejillas: 'alterado' },
            descripcion: '2 (mejillas): leve descamación',
          },
          indicadores: {
            higieneOral: { '16': { placa: 2, calculo: 1, gingivitis: 1 } },
            enfermedadPeriodontal: 'leve',
            maloclusion: 'angle-i',
          },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        motivoConsulta: 'Dolor en pieza 16',
        enfermedadActual: 'Dolor agudo desde hace dos días',
        embarazada: false,
      });
      expect(response.body.antecedentes.asma).toEqual({
        present: true,
        notes: 'Inhalador a mano',
      });
      expect(response.body.antecedentes.diabetes).toEqual({
        present: false,
        notes: null,
      });
      expect(response.body.signosVitales).toEqual({
        presionArterialSistolica: 120,
        presionArterialDiastolica: 80,
        frecuenciaCardiaca: 72,
        temperatura: 36.5,
        frecuenciaRespiratoria: 16,
      });
      expect(response.body.examenEstomatognatico.regiones.mejillas).toBe('alterado');
      expect(response.body.indicadores.enfermedadPeriodontal).toBe('leve');
      expect(response.body.indicadores.higieneOral['16']).toEqual({
        placa: 2,
        calculo: 1,
        gingivitis: 1,
      });
    });

    it('rejects an empty payload', async () => {
      const patient = await createPatient();
      const record = await openRecord(patient.id);

      await api().patch(`/clinical-records/${record.id}`).send({}).expect(400);
    });

    it('enforces domain invariants over HTTP (systolic > diastolic)', async () => {
      const patient = await createPatient();
      const record = await openRecord(patient.id);

      await api()
        .patch(`/clinical-records/${record.id}`)
        .send({
          signosVitales: {
            presionArterialSistolica: 80,
            presionArterialDiastolica: 120,
          },
        })
        .expect(400);
    });

    it('returns 404 for an unknown record', async () => {
      await api()
        .patch('/clinical-records/does-not-exist')
        .send({ motivoConsulta: 'x' })
        .expect(404);
    });
  });

  describe('odontogram findings and indices', () => {
    it('adds findings and derives the CPO/ceo indices server-side', async () => {
      const patient = await createPatient();
      const record = await openRecord(patient.id);

      const caries = await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 16, surfaces: ['O'], symbol: 'caries' })
        .expect(201);
      expect(caries.body).toMatchObject({
        tooth: 16,
        surfaces: ['O'],
        symbol: 'caries',
        state: 'a-realizar',
        isVoided: false,
      });

      const obturado = await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 26, symbol: 'obturado' })
        .expect(201);
      expect(obturado.body.state).toBe('realizado');

      const perdida = await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 55, symbol: 'perdida-caries' })
        .expect(201);
      expect(perdida.body.state).toBe('realizado');

      // Same tooth twice: it is still counted once, as C.
      await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 16, surfaces: ['V'], symbol: 'obturado' })
        .expect(201);

      const findings = await api()
        .get(`/clinical-records/${record.id}/findings`)
        .expect(200);
      expect(findings.body).toHaveLength(4);

      const indices = await api()
        .get(`/clinical-records/${record.id}/indices`)
        .expect(200);
      expect(indices.body.permanentes).toEqual({
        cariados: [16],
        perdidos: [],
        obturados: [26],
        total: 2,
      });
      expect(indices.body.temporales).toEqual({
        cariados: [],
        perdidos: [55],
        obturados: [],
        total: 1,
      });
      expect(indices.body.higieneOral).toEqual({
        placa: 0,
        calculo: 0,
        gingivitis: 0,
        total: 0,
      });
    });

    it('voids a finding keeping the log, and the projection drops it', async () => {
      const patient = await createPatient();
      const record = await openRecord(patient.id);

      const finding = await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 16, surfaces: ['O'], symbol: 'caries' })
        .expect(201);

      const voided = await api()
        .post(`/clinical-records/${record.id}/findings/${finding.body.id}/void`)
        .expect(201);

      expect(voided.body.isVoided).toBe(true);
      expect(voided.body.voidedAt).toEqual(expect.any(String));

      const log = await api()
        .get(`/clinical-records/${record.id}/findings`)
        .expect(200);
      expect(log.body).toHaveLength(1);
      expect(log.body[0].isVoided).toBe(true);

      const indices = await api()
        .get(`/clinical-records/${record.id}/indices`)
        .expect(200);
      expect(indices.body.permanentes.total).toBe(0);

      // The timeline keeps every action, newest first.
      const events = await api()
        .get(`/clinical-records/${record.id}/events`)
        .expect(200);
      expect(events.body.map((event: { action: string }) => event.action)).toEqual([
        'hallazgo-anulado',
        'hallazgo-agregado',
        'ficha-creada',
      ]);
    });

    it('rejects invalid findings (FDI tooth and symbol)', async () => {
      const patient = await createPatient();
      const record = await openRecord(patient.id);

      await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 19, symbol: 'caries' })
        .expect(400);

      await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 16, symbol: 'empaste' })
        .expect(400);

      await api()
        .post(`/clinical-records/${record.id}/findings`)
        .send({ tooth: 16, symbol: 'caries', recesion: 4 })
        .expect(400);
    });
  });

  describe('authorization', () => {
    it('requires an authenticated principal', async () => {
      await request(app.getHttpServer())
        .get('/clinical-records/whatever')
        .expect(401);

      await request(app.getHttpServer())
        .post('/patients/whatever/clinical-record')
        .send({})
        .expect(401);
    });
  });
});
