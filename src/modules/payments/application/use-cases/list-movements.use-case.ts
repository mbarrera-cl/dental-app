import { Injectable } from '@nestjs/common';
import type { Page } from '../../../../shared/application/pagination.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { Movement } from '../../domain/movement.entity.js';
import { LedgerRepositoryPort } from '../ports/ledger-repository.port.js';

export interface ListMovementsCommand {
  patientId: string;
  /** 1–100 (default 50). */
  limit?: number;
  offset?: number;
}

/**
 * History of the patient account, newest first. Pages are clamped (limit is
 * capped at 100; negatives fall back to the defaults) so a stray client cannot
 * dump the whole ledger.
 */
@Injectable()
export class ListMovementsUseCase implements UseCase<ListMovementsCommand, Page<Movement>> {
  static readonly DEFAULT_LIMIT = 50;
  static readonly MAX_LIMIT = 100;

  constructor(
    private readonly ledger: LedgerRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: ListMovementsCommand): Promise<Page<Movement>> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const limit =
      command.limit === undefined || command.limit < 1
        ? ListMovementsUseCase.DEFAULT_LIMIT
        : Math.min(command.limit, ListMovementsUseCase.MAX_LIMIT);
    const offset = command.offset === undefined || command.offset < 0 ? 0 : Math.floor(command.offset);

    const [items, total] = await Promise.all([
      this.ledger.listByPatient(patient.id, limit, offset),
      this.ledger.countByPatient(patient.id),
    ]);

    return { items, total, limit, offset };
  }
}
