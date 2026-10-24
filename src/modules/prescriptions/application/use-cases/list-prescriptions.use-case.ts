import { Injectable } from '@nestjs/common';
import type { Page } from '../../../../shared/application/pagination.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Prescription } from '../../domain/prescription.entity.js';
import { InvalidPrescriptionError } from '../../domain/prescription.errors.js';
import { PrescriptionRepositoryPort } from '../ports/prescription-repository.port.js';

export interface ListPrescriptionsCommand {
  patientId: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class ListPrescriptionsUseCase implements UseCase<
  ListPrescriptionsCommand,
  Page<Prescription>
> {
  constructor(private readonly prescriptions: PrescriptionRepositoryPort) {}

  async execute({
    patientId,
    limit = DEFAULT_LIMIT,
    offset = 0,
  }: ListPrescriptionsCommand): Promise<Page<Prescription>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new InvalidPrescriptionError(
        `limit must be an integer between 1 and ${MAX_LIMIT}`,
      );
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new InvalidPrescriptionError('offset must be a non-negative integer');
    }

    const [items, total] = await Promise.all([
      this.prescriptions.listByPatient(patientId, limit, offset),
      this.prescriptions.countByPatient(patientId),
    ]);

    return { items, total, limit, offset };
  }
}
