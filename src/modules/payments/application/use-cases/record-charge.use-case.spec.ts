import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { InMemoryLedgerRepository } from '../../infrastructure/adapters/persistence/in-memory-ledger.repository.js';
import { RecordChargeUseCase } from './record-charge.use-case.js';

describe('RecordChargeUseCase', () => {
  const newPatientProps = {
    rut: '12.345.678-5',
    nombres: 'Camila',
    apellidoPaterno: 'Rojas',
    apellidoMaterno: 'Pérez',
    fechaNacimiento: '1990-05-17',
    sexo: 'femenino',
  } as const;

  const setup = async () => {
    const patients = new InMemoryPatientRepository();
    const ledger = new InMemoryLedgerRepository();
    const useCase = new RecordChargeUseCase(ledger, patients);

    const patient = Patient.create({
      ...newPatientProps,
      numeroHistoria: await patients.nextNumeroHistoria(),
    });
    await patients.save(patient);

    return { patients, ledger, patient, useCase };
  };

  it('appends a charge linked to the canonical patient id', async () => {
    const { ledger, patient, useCase } = await setup();

    const movement = await useCase.execute({
      patientId: patient.id,
      concept: 'Atención consulta',
      amount: 15000,
      actorId: 'user-1',
    });

    expect(movement.kind).toBe('cargo');
    expect(movement.amount).toBe(15000);
    expect(movement.method).toBeNull();
    expect(movement.reference).toBeNull();
    expect(movement.patientId).toBe(patient.id);
    expect(movement.createdBy).toBe('user-1');
    expect(ledger.all().length).toBe(1);
    expect(await ledger.patientBalance(patient.id)).toBe(15000);
  });

  it('keeps optional links to a quote or an appointment', async () => {
    const { ledger, patient, useCase } = await setup();

    const movement = await useCase.execute({
      patientId: patient.id,
      concept: 'Resina compuesta pieza 1.6',
      amount: 4500,
      quoteId: 'quote-1',
      appointmentId: 'appointment-1',
      actorId: null,
    });

    expect(movement.quoteId).toBe('quote-1');
    expect(movement.appointmentId).toBe('appointment-1');
    expect((await ledger.findById(movement.id))?.quoteId).toBe('quote-1');
  });

  it('rejects charges of unknown patients', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({
        patientId: '00000000-0000-0000-0000-000000000000',
        concept: 'Consulta',
        amount: 100,
        actorId: null,
      }),
    ).rejects.toThrow(PatientNotFoundError);
  });
});
