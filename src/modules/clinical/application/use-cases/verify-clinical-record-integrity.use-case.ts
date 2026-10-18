import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import { computeIntegrityHash } from '../../domain/integrity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface VerifyClinicalIntegrityQuery {
  id: string;
}

export interface ClinicalIntegrityResult {
  status: 'borrador' | 'finalizada';
  finalized: boolean;
  /** `null` when the record has not been finalized yet. */
  valid: boolean | null;
  storedHash: string | null;
  computedHash: string;
}

/**
 * Recomputes the integrity hash of a ficha and compares it to the sealed one.
 * Useful to prove the record has not been tampered with after being closed.
 */
@Injectable()
export class VerifyClinicalRecordIntegrityUseCase implements UseCase<
  VerifyClinicalIntegrityQuery,
  ClinicalIntegrityResult
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ id }: VerifyClinicalIntegrityQuery): Promise<ClinicalIntegrityResult> {
    const record = await this.records.findById(id);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(id);
    }

    const findings = await this.records.listFindings(id);
    const computedHash = computeIntegrityHash(record, findings);

    return this.toResult(record, computedHash);
  }

  private toResult(record: FichaClinica, computedHash: string): ClinicalIntegrityResult {
    const storedHash = record.integrityHash;

    return {
      status: record.status,
      finalized: !record.isDraft,
      valid: storedHash === null ? null : storedHash === computedHash,
      storedHash,
      computedHash,
    };
  }
}
