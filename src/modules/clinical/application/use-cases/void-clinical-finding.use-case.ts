import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalFindingNotFoundError,
  ClinicalRecordLockedError,
  ClinicalRecordNotFoundError,
} from '../../domain/clinical.errors.js';
import type { Finding } from '../../domain/finding.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface VoidClinicalFindingCommand {
  recordId: string;
  findingId: string;
  actorId: string | null;
}

/**
 * Undo of a mistaken chart action. Nothing is deleted: the finding stays in
 * the log marked as voided, and the projection stops drawing it.
 */
@Injectable()
export class VoidClinicalFindingUseCase implements UseCase<
  VoidClinicalFindingCommand,
  Finding
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute(command: VoidClinicalFindingCommand): Promise<Finding> {
    const record = await this.records.findById(command.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(command.recordId);
    }

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    const finding = await this.records.findFinding(command.findingId);

    if (finding === null || finding.recordId !== record.id) {
      throw new ClinicalFindingNotFoundError(command.findingId);
    }

    finding.void(command.actorId);
    await this.records.updateFinding(finding);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'hallazgo-anulado',
        summary: `Pieza ${finding.tooth}: ${finding.symbol} anulado`,
        payload: {
          findingId: finding.id,
          tooth: finding.tooth,
          symbol: finding.symbol,
        },
      }),
    );

    return finding;
  }
}
