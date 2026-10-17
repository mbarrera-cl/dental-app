import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalRecordLockedError,
  ClinicalRecordNotFoundError,
} from '../../domain/clinical.errors.js';
import { Finding } from '../../domain/finding.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface AddClinicalFindingCommand {
  recordId: string;
  actorId: string | null;
  tooth: number;
  /** Empty/omitted surfaces means "the whole tooth". */
  surfaces?: readonly string[];
  symbol: string;
  recesion?: number | null;
  movilidad?: number | null;
  note?: string | null;
}

@Injectable()
export class AddClinicalFindingUseCase implements UseCase<
  AddClinicalFindingCommand,
  Finding
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute(command: AddClinicalFindingCommand): Promise<Finding> {
    const record = await this.records.findById(command.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(command.recordId);
    }

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    const finding = Finding.create({
      recordId: record.id,
      tooth: command.tooth,
      surfaces: command.surfaces,
      symbol: command.symbol,
      recesion: command.recesion,
      movilidad: command.movilidad,
      note: command.note,
      createdBy: command.actorId,
    });

    await this.records.saveFinding(finding);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'hallazgo-agregado',
        summary: `Pieza ${finding.tooth}: ${finding.symbol}`,
        payload: {
          findingId: finding.id,
          tooth: finding.tooth,
          surfaces: finding.surfaces,
          symbol: finding.symbol,
          state: finding.state,
        },
      }),
    );

    return finding;
  }
}
