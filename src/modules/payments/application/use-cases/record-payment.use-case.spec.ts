import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { InMemoryLedgerRepository } from '../../infrastructure/adapters/persistence/in-memory-ledger.repository.js';
import { InvalidMovementError } from '../../domain/payment.errors.js';
import { RecordChargeUseCase } from './record-charge.use-case.js';
import { RecordPaymentUseCase } from './record-payment.use-case.js';

describe('RecordPaymentUseCase', () => {
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
    const charges = new RecordChargeUseCase(ledger, patients);
    const useCase = new RecordPaymentUseCase(ledger, patients);

    const patient = Patient.create({
      ...newPatientProps,
      numeroHistoria: await patients.nextNumeroHistoria(),
    });
    await patients.save(patient);

    return { ledger, patient, charges, useCase };
  };

  it('appends a payment that subtracts from the balance', async () => {
    const { ledger, patient, charges, useCase } = await setup();

    await charges.execute({
      patientId: patient.id,
      concept: 'Consulta',
      amount: 15000,
      actorId: null,
    });

    const movement = await useCase.execute({
      patientId: patient.id,
      concept: 'Abono parcial anual',
      amount: 5000,
      method: 'transferencia',
      reference: 'op/42 BancoEstado',
      actorId: 'user-1',
    });

    expect(movement.kind).toBe('abono');
    expect(movement.signedAmount).toBe(-5000);
    expect(movement.method).toBe('transferencia');
    expect(movement.reference).toBe('op/42 BancoEstado');
    expect(await ledger.patientBalance(patient.id)).toBe(10000);
  });

  it('records each method through the typed command', async () => {
    const { patient, useCase } = await setup();

    for (const method of ['efectivo', 'tarjeta', 'transferencia'] as const) {
      const movement = await useCase.execute({
        patientId: patient.id,
        concept: `Abono ${method}`,
        amount: 1000 + method.length,
        method,
        actorId: null,
      });

      expect(movement.method).toBe(method);
    }
  });

  it('rejects payments of unknown patients', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({
        patientId: '00000000-0000-0000-0000-000000000000',
        concept: 'Abono',
        amount: 100,
        method: 'efectivo',
        actorId: null,
      }),
    ).rejects.toThrow(PatientNotFoundError);
  });

  it('lets the entity reject malformed payments', async () => {
    const { patient, useCase } = await setup();

    // DTO validation would stop this first; the entity still refuses it.
    await expect(
      useCase.execute({
        patientId: patient.id,
        concept: 'Abono sin método',
        amount: 1000,
        method: undefined as never,
        actorId: null,
      }),
    ).rejects.toThrow(InvalidMovementError);

    await expect(
      useCase.execute({
        patientId: patient.id,
        concept: 'Abono cero',
        amount: 0,
        method: 'efectivo',
        actorId: null,
      }),
    ).rejects.toThrow(InvalidMovementError);
  });
});
