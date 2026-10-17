import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import type { Finding } from '../../domain/finding.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface ListClinicalFindingsQuery {
  recordId: string;
}

/**
 * Full log (voided findings included, oldest first): the chart is a
 * projection computed by whoever consumes it, and the per-tooth history
 * needs the voided entries too.
 */
@Injectable()
export class ListClinicalFindingsUseCase implements UseCase<
  ListClinicalFindingsQuery,
  Finding[]
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ recordId }: ListClinicalFindingsQuery): Promise<Finding[]> {
    const record = await this.records.findById(recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(recordId);
    }

    return this.records.listFindings(recordId);
  }
}
