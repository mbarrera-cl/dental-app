import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { AddClinicalFindingUseCase } from './add-clinical-finding.use-case.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';

describe('AddClinicalFindingUseCase', () => {
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

    return { records, record, useCase: new AddClinicalFindingUseCase(records) };
  };

  it('appends the finding and the hallazgo-agregado event', async () => {
    const { useCase, records, record } = await setup();

    const finding = await useCase.execute({
      recordId: record.id,
      actorId: 'user-1',
      tooth: 16,
      surfaces: ['O'],
      symbol: 'caries',
    });

    expect(finding.state).toBe('a-realizar');
    expect(finding.createdBy).toBe('user-1');

    const log = await records.listFindings(record.id);
    expect(log).toHaveLength(1);

    const events = await records.listEvents(record.id);
    expect(events[0]?.action).toBe('hallazgo-agregado');
    expect(events[0]?.payload).toMatchObject({ tooth: 16, symbol: 'caries' });
  });

  it('rejects an unknown record', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ recordId: 'nope', actorId: null, tooth: 16, symbol: 'caries' }),
    ).rejects.toBeInstanceOf(ClinicalRecordNotFoundError);
  });
});
