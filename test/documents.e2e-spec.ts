import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/shared/infrastructure/app-setup.js';
import { PostgresDatabase } from './../src/shared/infrastructure/database/postgres-database.js';
import {
  closePostgresTestDatabase,
  createPostgresTestDatabase,
} from './helpers/postgres-test-database.js';
import {
  clearE2eAdminCredentials,
  loginAsAdmin,
  useE2eAdminCredentials,
} from './helpers/auth.js';

describe('Prescriptions and consents API (e2e)', () => {
  let app: INestApplication<App>;
  let database: PostgresDatabase;
  let authorization: string;

  const patient = {
    rut: '12.345.678-5',
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

  const api = () => {
    const base = request(app.getHttpServer());

    return {
      get: (url: string) => base.get(url).set('Authorization', authorization),
      post: (url: string) => base.post(url).set('Authorization', authorization),
      put: (url: string) => base.put(url).set('Authorization', authorization),
    };
  };

  const createPatient = async (): Promise<string> => {
    const response = await api().post('/patients').send(patient).expect(201);

    return response.body.id as string;
  };

  describe('prescriptions', () => {
    it('issues a prescription and lists it for the patient', async () => {
      const patientId = await createPatient();

      const created = await api()
        .post(`/patients/${patientId}/prescriptions`)
        .send({
          items: [
            {
              medicamento: 'Amoxicilina 500 mg',
              dosis: '1 comprimido',
              frecuencia: 'Cada 8 horas',
              duracion: '7 días',
            },
          ],
          indicaciones: 'Con alimentos',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        patientId,
        patientName: 'Camila Rojas Pérez',
        patientRut: '12345678-5',
        indicaciones: 'Con alimentos',
        issuedByName: 'Administrator',
      });
      expect(created.body.items).toHaveLength(1);
      expect(created.body.items[0].medicamento).toBe('Amoxicilina 500 mg');

      const list = await api()
        .get(`/patients/${patientId}/prescriptions`)
        .expect(200);

      expect(list.body.items).toHaveLength(1);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0].id).toBe(created.body.id);

      const one = await api()
        .get(`/prescriptions/${created.body.id}`)
        .expect(200);

      expect(one.body.id).toBe(created.body.id);
    });

    it('rejects a prescription without medications', async () => {
      const patientId = await createPatient();

      await api()
        .post(`/patients/${patientId}/prescriptions`)
        .send({ items: [] })
        .expect(400);
    });
  });

  describe('consents', () => {
    it('lists the seeded templates', async () => {
      const response = await api().get('/consents/templates').expect(200);
      const keys = (response.body as Array<{ key: string }>).map((item) => item.key);

      expect(keys).toEqual(
        expect.arrayContaining(['extraccion', 'endodoncia', 'implante', 'cirugia']),
      );
    });

    it('records an acceptance with a frozen template snapshot', async () => {
      const patientId = await createPatient();

      const created = await api()
        .post(`/patients/${patientId}/consents`)
        .send({
          templateKey: 'extraccion',
          procedure: 'Extracción pieza 3.6',
          acceptorName: 'Camila Rojas',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        patientId,
        patientName: 'Camila Rojas Pérez',
        patientRut: '12345678-5',
        templateKey: 'extraccion',
        templateVersion: 1,
        procedure: 'Extracción pieza 3.6',
        acceptorName: 'Camila Rojas',
      });
      expect(created.body.body).toContain('{{paciente}}');

      const list = await api()
        .get(`/patients/${patientId}/consents`)
        .expect(200);

      expect(list.body.items).toHaveLength(1);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0].id).toBe(created.body.id);

      const one = await api().get(`/consents/${created.body.id}`).expect(200);
      expect(one.body.id).toBe(created.body.id);
    });

    it('creates or edits a template by key and bumps its version', async () => {
      const created = await api()
        .put('/consents/templates')
        .send({
          key: 'periodoncia',
          title: 'Consentimiento informado: periodoncia',
          body: 'Yo, {{paciente}}, autorizo {{procedimiento}}.',
        })
        .expect(200);

      expect(created.body.version).toBe(1);
      expect(created.body.active).toBe(true);

      const edited = await api()
        .put('/consents/templates')
        .send({
          key: 'periodoncia',
          title: 'Consentimiento informado: periodoncia',
          body: 'Yo, {{paciente}}, autorizo {{procedimiento}} con controles.',
        })
        .expect(200);

      expect(edited.body.id).toBe(created.body.id);
      expect(edited.body.version).toBe(2);
    });
  });
});
