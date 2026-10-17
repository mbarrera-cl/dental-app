import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { Patient } from '../../../domain/patient.entity.js';
import {
  PatientAlreadyExistsError,
  PatientNotFoundError,
} from '../../../domain/patient.errors.js';
import { SqlitePatientRepository } from './sqlite-patient.repository.js';

describe('SqlitePatientRepository', () => {
  let database: SqliteDatabase;
  let repository: SqlitePatientRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    repository = new SqlitePatientRepository(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  /** Sequential HC numbers keep the UNIQUE index happy across patients. */
  let numeroHistoriaSequence = 0;

  const makePatient = (rut = '12345678-5', nombres = 'Camila') =>
    Patient.create({
      rut,
      nombres,
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
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
      numeroHistoria: `HC-${String((numeroHistoriaSequence += 1)).padStart(6, '0')}`,
    });

  it('saves a patient and reconstitutes every field from the database', async () => {
    const patient = makePatient();

    await repository.save(patient);
    const found = await repository.findById(patient.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(patient.id);
    expect(found?.rut).toBe('12345678-5');
    expect(found?.nombres).toBe('Camila');
    expect(found?.apellidoPaterno).toBe('Rojas');
    expect(found?.apellidoMaterno).toBe('Pérez');
    expect(found?.fechaNacimiento).toBe('1990-05-17');
    expect(found?.sexo).toBe('femenino');
    expect(found?.email).toBe('camila@example.com');
    expect(found?.telefono).toBe('+56912345678');
    expect(found?.direccion?.region).toBe('RM');
    expect(found?.direccion?.comuna).toBe('Providencia');
    expect(found?.direccion?.departamento).toBe('Depto 51');
    expect(found?.prevision?.tipo).toBe('FONASA');
    expect(found?.prevision?.tramo).toBe('B');
    expect(found?.contactoEmergencia?.telefono).toBe('+56987654321');
    expect(found?.contactoEmergencia?.parentesco).toBe('Madre');
    expect(found?.notas).toBe('Alergia a la penicilina');
    expect(found?.numeroHistoria).toBe(patient.numeroHistoria);
    expect(found?.createdAt).toEqual(patient.createdAt);
  });

  it('round-trips a patient without optional groups', async () => {
    const patient = Patient.create({
      rut: '22222222-2',
      nombres: 'Grace',
      apellidoPaterno: 'Muñoz',
      apellidoMaterno: 'Soto',
      fechaNacimiento: '1988-03-10',
      sexo: 'otro',
      numeroHistoria: 'HC-000124',
    });

    await repository.save(patient);
    const found = await repository.findById(patient.id);

    expect(found?.email).toBeNull();
    expect(found?.telefono).toBeNull();
    expect(found?.direccion).toBeNull();
    expect(found?.prevision).toBeNull();
    expect(found?.contactoEmergencia).toBeNull();
    expect(found?.notas).toBeNull();
  });

  it('translates unique RUT violations into PatientAlreadyExistsError', async () => {
    await repository.save(makePatient());

    await expect(
      repository.save(makePatient('12345678-5', 'Camila Again')),
    ).rejects.toThrow(PatientAlreadyExistsError);
  });

  it('updates an existing patient', async () => {
    const patient = makePatient();
    await repository.save(patient);

    patient.changeNombres('Camila Ignacia');
    patient.changeTelefono(null);
    patient.changeNotas(null);
    await repository.update(patient);

    const found = await repository.findById(patient.id);
    expect(found?.nombres).toBe('Camila Ignacia');
    expect(found?.telefono).toBeNull();
    expect(found?.notas).toBeNull();
  });

  it('throws PatientNotFoundError when updating or deleting unknown patients', async () => {
    const ghost = makePatient();

    await expect(repository.update(ghost)).rejects.toThrow(
      PatientNotFoundError,
    );
    await expect(repository.delete(ghost.id)).rejects.toThrow(
      PatientNotFoundError,
    );
  });

  it('deletes a patient', async () => {
    const patient = makePatient();
    await repository.save(patient);

    await repository.delete(patient.id);

    await expect(repository.findById(patient.id)).resolves.toBeNull();
  });

  it('finds by RUT and lists patients in insertion order', async () => {
    const camila = makePatient();
    const grace = makePatient('22222222-2', 'Grace');
    await repository.save(camila);
    await repository.save(grace);

    await expect(repository.findByRut('12345678-5')).resolves.toMatchObject({
      id: camila.id,
    });
    await expect(repository.findByRut('9999999-3')).resolves.toBeNull();

    const all = await repository.findAll();
    expect(all.map((patient) => patient.id)).toEqual([camila.id, grace.id]);
  });

  it('assigns sequential numeros de historia and persists them on update', async () => {
    await expect(repository.nextNumeroHistoria()).resolves.toBe('HC-000001');
    await expect(repository.nextNumeroHistoria()).resolves.toBe('HC-000002');

    const patient = makePatient();
    await repository.save(patient);

    // Simulate a legacy row: no number until the backfill assigns one.
    database.connection
      .prepare('UPDATE patients SET numero_historia = NULL WHERE id = ?')
      .run(patient.id);

    const [legacy] = await repository.findWithoutNumeroHistoria();
    expect(legacy?.id).toBe(patient.id);

    legacy?.changeNumeroHistoria('HC-000003');
    await repository.update(legacy!);

    const found = await repository.findById(patient.id);
    expect(found?.numeroHistoria).toBe('HC-000003');
    await expect(repository.findWithoutNumeroHistoria()).resolves.toEqual([]);
  });
});
