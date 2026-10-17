import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { computeClinicalIndices, type ClinicalIndices } from '../../domain/clinical-indices.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface GetClinicalIndicesQuery {
  recordId: string;
}

/**
 * CPO/ceo indices are never stored: they are always derived from the
 * odontogram log and the hygiene table, so they cannot drift out of sync.
 */
@Injectable()
export class GetClinicalIndicesUseCase implements UseCase<
  GetClinicalIndicesQuery,
  ClinicalIndices
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ recordId }: GetClinicalIndicesQuery): Promise<ClinicalIndices> {
    const record = await this.records.findById(recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(recordId);
    }

    const findings = await this.records.listFindings(recordId);

    return computeClinicalIndices(findings, record.indicadores.higieneOral);
  }
}
