import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { ClinicalRecordLockedError } from '../../domain/clinical.errors.js';
import { Finding } from '../../domain/finding.entity.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';
import { FinalizeClinicalRecordUseCase } from './finalize-clinical-record.use-case.js';
import { VerifyClinicalRecordIntegrityUseCase } from './verify-clinical-record-integrity.use-case.js';

describe('FinalizeClinicalRecordUseCase', () => {
  const setup = async () => {
    const patients = new InMemoryPatientRepository();
    const records = new InMemoryClinicalRecordRepository();
    const patient = Patient.create({
      rut: '12.345.678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '1990-05-17',
      sexo: 'femenino',
      numeroHistoria: 'HC-000001',
    });
    await patients.save(patient);

    const record = await new CreateClinicalRecordUseCase(records, patients).execute({
      patientId: patient.id,
      actorId: 'user-1',
    });

    return {
      records,
      record,
      finalize: new FinalizeClinicalRecordUseCase(records),
      verify: new VerifyClinicalRecordIntegrityUseCase(records),
    };
  };

  it('finalizes the record, seals it and appends a ficha-finalizada event', async () => {
    const { records, record, finalize } = await setup();

    await records.saveFinding(
      Finding.create({
        recordId: record.id,
        tooth: 36,
        surfaces: ['O'],
        symbol: 'caries',
        createdBy: 'user-1',
      }),
    );

    const finalized = await finalize.execute({ id: record.id, actorId: 'user-1' });

    expect(finalized.status).toBe('finalizada');
    expect(finalized.finalizedBy).toBe('user-1');
    expect(finalized.finalizedAt).not.toBeNull();
    expect(finalized.integrityHash).toMatch(/^[0-9a-f]{64}$/);

    const events = await records.listEvents(record.id);
    expect(events[0].action).toBe('ficha-finalizada');
  });

  it('marks the record as valid immediately after finalizing', async () => {
    const { record, finalize, verify } = await setup();

    await finalize.execute({ id: record.id, actorId: 'user-1' });

    const result = await verify.execute({ id: record.id });
    expect(result.finalized).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.storedHash).toBe(result.computedHash);
  });

  it('rejects finalizing a record that is already finalized', async () => {
    const { record, finalize } = await setup();

    await finalize.execute({ id: record.id, actorId: 'user-1' });

    await expect(finalize.execute({ id: record.id, actorId: 'user-1' })).rejects.toBeInstanceOf(
      ClinicalRecordLockedError,
    );
  });

  it('rejects finalizing a missing record', async () => {
    const { finalize } = await setup();

    await expect(finalize.execute({ id: 'missing', actorId: 'user-1' })).rejects.toMatchObject({
      name: 'ClinicalRecordNotFoundError',
    });
  });
});
