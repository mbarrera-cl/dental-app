import { Patient } from '../../../patients/domain/patient.entity.js';
import { InMemoryPatientRepository } from '../../../patients/infrastructure/adapters/persistence/in-memory-patient.repository.js';
import { InMemoryLedgerRepository } from '../../infrastructure/adapters/persistence/in-memory-ledger.repository.js';
import { MovementAlreadyVoidedError, MovementNotFoundError } from '../../domain/payment.errors.js';
import { RecordPaymentUseCase } from './record-payment.use-case.js';
import { VoidMovementUseCase } from './void-movement.use-case.js';

describe('VoidMovementUseCase', () => {
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
    const recordPayment = new RecordPaymentUseCase(ledger, patients);
    const useCase = new VoidMovementUseCase(ledger);

    const patient = Patient.create({
      ...newPatientProps,
      numeroHistoria: await patients.nextNumeroHistoria(),
    });
    await patients.save(patient);

    return { ledger, patient, recordPayment, useCase };
  };

  it('annuls a payment, keeping the row and healing the balance', async () => {
    const { ledger, patient, recordPayment, useCase } = await setup();

    const movement = await recordPayment.execute({
      patientId: patient.id,
      concept: 'Abono',
      amount: 5000,
      method: 'efectivo',
      actorId: 'user-1',
    });

    const voided = await useCase.execute({
      id: movement.id,
      reason: 'pago duplicado',
      actorId: 'user-2',
    });

    expect(voided.isVoided).toBe(true);
    expect(voided.voidReason).toBe('pago duplicado');
    expect(voided.voidedBy).toBe('user-2');
    expect(ledger.all().length).toBe(1);
    expect(await ledger.patientBalance(patient.id)).toBe(0);
  });

  it('rejects voids of unknown movements', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ id: 'does-not-exist', reason: 'error', actorId: null }),
    ).rejects.toThrow(MovementNotFoundError);
  });

  it('rejects a second void with a conflict', async () => {
    const { patient, recordPayment, useCase } = await setup();

    const movement = await recordPayment.execute({
      patientId: patient.id,
      concept: 'Abono',
      amount: 5000,
      method: 'efectivo',
      actorId: null,
    });
    await useCase.execute({ id: movement.id, reason: 'primera vez', actorId: null });
    await expect(
      useCase.execute({ id: movement.id, reason: 'segunda vez', actorId: null }),
    ).rejects.toThrow(MovementAlreadyVoidedError);
  });
});
