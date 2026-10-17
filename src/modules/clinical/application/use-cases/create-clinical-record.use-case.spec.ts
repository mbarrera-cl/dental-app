import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { suggestCategoriaEtaria } from '../../domain/categoria-etaria.js';
import { ClinicalRecordAlreadyExistsError } from '../../domain/clinical.errors.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';

describe('CreateClinicalRecordUseCase', () => {
  const setup = async () => {
    const patients = new InMemoryPatientRepository();
    const records = new InMemoryClinicalRecordRepository();
    const patient = Patient.create({
      rut: '12.345.678-5',
      nombres: 'Camila',
      apellidoPaterno: 'Rojas',
      apellidoMaterno: 'Pérez',
      fechaNacimiento: '2015-05-17',
      sexo: 'femenino',
      numeroHistoria: 'HC-000001',
    });

    await patients.save(patient);

    return {
      patients,
      records,
      patient,
      useCase: new CreateClinicalRecordUseCase(records, patients),
    };
  };

  it('opens the record with the category suggested from the birth date', async () => {
    const { useCase, patient } = await setup();

    const record = await useCase.execute({ patientId: patient.id, actorId: 'user-1' });

    expect(record.patientId).toBe(patient.id);
    expect(record.categoria).toBe(suggestCategoriaEtaria(patient.fechaNacimiento));
    expect(record.embarazada).toBe(false);
    expect(record.status).toBe('borrador');
  });

  it('accepts an explicit category override (not-programado range)', async () => {
    const { useCase, patient } = await setup();

    const record = await useCase.execute({
      patientId: patient.id,
      actorId: 'user-1',
      categoria: '5-14-no-programado',
    });

    expect(record.categoria).toBe('5-14-no-programado');
  });

  it('rejects an unknown patient', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ patientId: 'does-not-exist', actorId: 'user-1' }),
    ).rejects.toBeInstanceOf(PatientNotFoundError);
  });

  it('rejects a second record for the same patient', async () => {
    const { useCase, patient } = await setup();

    await useCase.execute({ patientId: patient.id, actorId: 'user-1' });

    await expect(
      useCase.execute({ patientId: patient.id, actorId: 'user-1' }),
    ).rejects.toBeInstanceOf(ClinicalRecordAlreadyExistsError);
  });

  it('appends the ficha-creada event with the actor', async () => {
    const { useCase, records, patient } = await setup();

    const record = await useCase.execute({ patientId: patient.id, actorId: 'user-1' });
    const events = await records.listEvents(record.id);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'ficha-creada',
      actorId: 'user-1',
      patientId: patient.id,
      recordId: record.id,
    });
  });
});
