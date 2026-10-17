import { SqliteDatabase } from '../../../../../shared/infrastructure/database/sqlite-database.js';
import { Antecedentes } from '../../../domain/antecedentes.vo.js';
import { ClinicalEvent } from '../../../domain/clinical-event.entity.js';
import { ClinicalRecordAlreadyExistsError } from '../../../domain/clinical.errors.js';
import { FichaClinica } from '../../../domain/ficha-clinica.entity.js';
import { Finding } from '../../../domain/finding.entity.js';
import { IndicadoresSaludBucal } from '../../../domain/indicadores.vo.js';
import { SqliteClinicalRecordRepository } from './sqlite-clinical-record.repository.js';

describe('SqliteClinicalRecordRepository', () => {
  let database: SqliteDatabase;
  let repository: SqliteClinicalRecordRepository;

  beforeEach(() => {
    database = new SqliteDatabase(':memory:');
    // The FKs on clinical_records (patient_id, created_by, updated_by)
    // require real rows in patients and users.
    database.connection
      .prepare(
        `INSERT INTO patients (
           id, rut, nombres, apellido_paterno, apellido_materno,
           fecha_nacimiento, sexo, created_at
         ) VALUES (
           'patient-1', '12345678-5', 'Camila', 'Rojas', 'Pérez',
           '1990-05-17', 'femenino', '2026-01-01T00:00:00.000Z'
         )`,
      )
      .run();
    database.connection
      .prepare(
        `INSERT INTO users (id, email, name, created_at) VALUES
           ('user-1', 'user1@test.local', 'User One', '2026-01-01T00:00:00.000Z'),
           ('user-2', 'user2@test.local', 'User Two', '2026-01-01T00:00:00.000Z')`,
      )
      .run();

    repository = new SqliteClinicalRecordRepository(database);
  });

  afterEach(() => {
    database.onModuleDestroy();
  });

  const makeRecord = () =>
    FichaClinica.create({
      patientId: 'patient-1',
      categoria: '5-9-programado',
      createdBy: 'user-1',
    });

  it('round-trips a record with every composite section', async () => {
    const record = makeRecord();

    record.changeMotivoConsulta('Dolor en pieza 16');
    record.changeAntecedentes(
      Antecedentes.create({ asma: { present: true, notes: 'Inhalador' } }),
    );
    record.changeIndicadores(
      IndicadoresSaludBucal.create({
        higieneOral: { '16': { placa: 2, calculo: 1, gingivitis: 1 } },
        maloclusion: 'angle-i',
      }),
    );
    await repository.save(record);

    const found = await repository.findById(record.id);

    expect(found?.motivoConsulta).toBe('Dolor en pieza 16');
    expect(found?.categoria).toBe('5-9-programado');
    expect(found?.antecedentes.get('asma')).toEqual({
      present: true,
      notes: 'Inhalador',
    });
    expect(found?.indicadores.maloclusion).toBe('angle-i');
    expect(found?.indicadores.higieneOral.get(16).placa).toBe(2);
    expect(found?.createdAt).toEqual(record.createdAt);

    const byPatient = await repository.findByPatientId('patient-1');
    expect(byPatient?.id).toBe(record.id);
    await expect(repository.findByPatientId('nope')).resolves.toBeNull();
  });

  it('enforces one record per patient', async () => {
    await repository.save(makeRecord());

    await expect(repository.save(makeRecord())).rejects.toBeInstanceOf(
      ClinicalRecordAlreadyExistsError,
    );
  });

  it('persists updates and throws when the record does not exist', async () => {
    const record = makeRecord();
    await repository.save(record);

    record.changeMotivoConsulta('Control');
    record.touch('user-2');
    await repository.update(record);

    const found = await repository.findById(record.id);
    expect(found?.motivoConsulta).toBe('Control');
    expect(found?.updatedBy).toBe('user-2');

    const orphan = makeRecord();
    await expect(repository.update(orphan)).rejects.toThrow(
      expect.objectContaining({ name: 'ClinicalRecordNotFoundError' }),
    );
  });

  it('keeps the append-only findings log, including voided entries', async () => {
    const record = makeRecord();
    await repository.save(record);

    const finding = Finding.create({
      recordId: record.id,
      tooth: 16,
      surfaces: ['O'],
      symbol: 'caries',
      createdBy: 'user-1',
    });
    await repository.saveFinding(finding);

    const [stored] = await repository.listFindings(record.id);
    expect(stored?.surfaces).toEqual(['O']);
    expect(stored?.symbol).toBe('caries');

    stored?.void('user-2');
    await repository.updateFinding(stored!);

    const after = await repository.findFinding(finding.id);
    expect(after?.isVoided).toBe(true);
    expect(after?.voidedBy).toBe('user-2');
    expect(await repository.listFindings(record.id)).toHaveLength(1);
  });

  it('appends events and lists them newest first', async () => {
    const record = makeRecord();
    await repository.save(record);

    const first = ClinicalEvent.create({
      patientId: record.patientId,
      recordId: record.id,
      actorId: 'user-1',
      action: 'ficha-creada',
    });
    const second = ClinicalEvent.create({
      patientId: record.patientId,
      recordId: record.id,
      actorId: 'user-2',
      action: 'hallazgo-agregado',
      payload: { tooth: 16, symbol: 'caries' },
    });
    await repository.appendEvent(first);
    await repository.appendEvent(second);

    const events = await repository.listEvents(record.id);

    expect(events.map((event) => event.id)).toEqual([second.id, first.id]);
    expect(events[0]?.payload).toEqual({ tooth: 16, symbol: 'caries' });
    expect(events[1]?.actorId).toBe('user-1');
  });
});
