import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { ClinicalFindingNotFoundError } from '../../domain/clinical.errors.js';
import { InMemoryClinicalRecordRepository } from '../../infrastructure/adapters/persistence/in-memory-clinical-record.repository.js';
import { AddClinicalFindingUseCase } from './add-clinical-finding.use-case.js';
import { CreateClinicalRecordUseCase } from './create-clinical-record.use-case.js';
import { VoidClinicalFindingUseCase } from './void-clinical-finding.use-case.js';

describe('VoidClinicalFindingUseCase', () => {
  const setup = async (rut = '12.345.678-5') => {
    const patients = new InMemoryPatientRepository();
    const records = new InMemoryClinicalRecordRepository();
    const patient = Patient.create({
      rut,
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
      addFinding: new AddClinicalFindingUseCase(records),
      useCase: new VoidClinicalFindingUseCase(records),
    };
  };

  it('voids the finding keeping the history and appends the hallazgo-anulado event', async () => {
    const { addFinding, useCase, records, record } = await setup();
    const finding = await addFinding.execute({
      recordId: record.id,
      actorId: 'user-1',
      tooth: 16,
      symbol: 'caries',
    });

    const voided = await useCase.execute({
      recordId: record.id,
      findingId: finding.id,
      actorId: 'user-2',
    });

    expect(voided.isVoided).toBe(true);
    expect(voided.voidedBy).toBe('user-2');

    const log = await records.listFindings(record.id);
    expect(log).toHaveLength(1);
    expect(log[0]?.isVoided).toBe(true);

    const events = await records.listEvents(record.id);
    expect(events[0]?.action).toBe('hallazgo-anulado');
    expect(events[0]?.actorId).toBe('user-2');
  });

  it('rejects findings that belong to another record', async () => {
    const first = await setup();
    const second = await setup('22.222.222-2');
    const finding = await second.addFinding.execute({
      recordId: second.record.id,
      actorId: 'user-1',
      tooth: 16,
      symbol: 'caries',
    });

    await expect(
      first.useCase.execute({
        recordId: first.record.id,
        findingId: finding.id,
        actorId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(ClinicalFindingNotFoundError);
  });

  it('rejects voiding the same finding twice', async () => {
    const { addFinding, useCase, record } = await setup();
    const finding = await addFinding.execute({
      recordId: record.id,
      actorId: 'user-1',
      tooth: 16,
      symbol: 'caries',
    });

    await useCase.execute({ recordId: record.id, findingId: finding.id, actorId: 'u' });

    await expect(
      useCase.execute({ recordId: record.id, findingId: finding.id, actorId: 'u' }),
    ).rejects.toThrow(
      expect.objectContaining({ name: 'ClinicalFindingAlreadyVoidedError' }),
    );
  });
});
