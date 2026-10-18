import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import { computeIntegrityHash } from '../../domain/integrity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface FinalizeClinicalRecordCommand {
  id: string;
  actorId: string | null;
}

/**
 * Seals the ficha: computes the integrity hash over the record and its
 * non-voided findings, locks it (`finalizada`) and appends a
 * `ficha-finalizada` audit event. Finalizing a record that is already
 * finalized throws `ClinicalRecordLockedError` (HTTP 423).
 */
@Injectable()
export class FinalizeClinicalRecordUseCase implements UseCase<
  FinalizeClinicalRecordCommand,
  FichaClinica
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ id, actorId }: FinalizeClinicalRecordCommand): Promise<FichaClinica> {
    const record = await this.records.findById(id);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(id);
    }

    const findings = await this.records.listFindings(id);
    const integrityHash = computeIntegrityHash(record, findings);

    record.finalize(actorId, integrityHash);
    await this.records.update(record);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId,
        action: 'ficha-finalizada',
        summary: 'Ficha clínica cerrada',
        payload: { integrityHash },
      }),
    );

    return record;
  }
}
