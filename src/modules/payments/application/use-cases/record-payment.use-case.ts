import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { Movement } from '../../domain/movement.entity.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface RecordPaymentCommand {
  patientId: string;
  concept: string;
  amount: number;
  method: 'efectivo' | 'tarjeta' | 'transferencia';
  reference?: string | null;
  quoteId?: string | null;
  appointmentId?: string | null;
  actorId: string | null;
}

/**
 * Records a payment (abono) on the patient account. The method is required
 * (efectivo/tarjeta/transferencia) and the reference reconciles vouchers and
 * bank transfers.
 */
@Injectable()
export class RecordPaymentUseCase implements UseCase<RecordPaymentCommand, Movement> {
  constructor(
    private readonly ledger: LedgerRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: RecordPaymentCommand): Promise<Movement> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const movement = Movement.create({
      kind: 'abono',
      amount: command.amount,
      method: command.method,
      reference: command.reference ?? null,
      concept: command.concept,
      patientId: patient.id,
      quoteId: command.quoteId ?? null,
      appointmentId: command.appointmentId ?? null,
      createdBy: command.actorId,
    });

    await this.ledger.append(movement);

    return movement;
  }
}
