import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { Movement } from '../../domain/movement.entity.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface RecordChargeCommand {
  patientId: string;
  concept: string;
  amount: number;
  quoteId?: string | null;
  appointmentId?: string | null;
  actorId: string | null;
}

/**
 * Records a charge on the patient account. Charges are validated against the
 * real patient id; the amount, the method rules and the concept length are the
 * entity's job (`Movement.create`).
 */
@Injectable()
export class RecordChargeUseCase implements UseCase<RecordChargeCommand, Movement> {
  constructor(
    private readonly ledger: LedgerRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: RecordChargeCommand): Promise<Movement> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const movement = Movement.create({
      kind: 'cargo',
      amount: command.amount,
      method: null,
      reference: null,
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
