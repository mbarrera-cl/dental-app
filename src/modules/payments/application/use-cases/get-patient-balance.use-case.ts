import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface GetPatientBalanceCommand {
  patientId: string;
}

/**
 * Balance of the patient account: `sum(non-voided cargos) − sum(non-voided
 * payments)`. Computed on the fly — it never needs to be re-synced.
 */
@Injectable()
export class GetPatientBalanceUseCase implements UseCase<GetPatientBalanceCommand, number> {
  constructor(
    private readonly ledger: LedgerRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: GetPatientBalanceCommand): Promise<number> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    return this.ledger.patientBalance(patient.id);
  }
}
