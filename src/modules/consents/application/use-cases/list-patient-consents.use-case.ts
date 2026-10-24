import { Injectable } from '@nestjs/common';
import type { Page } from '../../../../shared/application/pagination.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConsentRecord } from '../../domain/consent-record.entity.js';
import { InvalidConsentError } from '../../domain/consent.errors.js';
import { ConsentRecordRepositoryPort } from '../ports/consent-record-repository.port.js';

export interface ListPatientConsentsCommand {
  patientId: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class ListPatientConsentsUseCase implements UseCase<
  ListPatientConsentsCommand,
  Page<ConsentRecord>
> {
  constructor(private readonly records: ConsentRecordRepositoryPort) {}

  async execute({
    patientId,
    limit = DEFAULT_LIMIT,
    offset = 0,
  }: ListPatientConsentsCommand): Promise<Page<ConsentRecord>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new InvalidConsentError(
        `limit must be an integer between 1 and ${MAX_LIMIT}`,
      );
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new InvalidConsentError('offset must be a non-negative integer');
    }

    const [items, total] = await Promise.all([
      this.records.listByPatient(patientId, limit, offset),
      this.records.countByPatient(patientId),
    ]);

    return { items, total, limit, offset };
  }
}
