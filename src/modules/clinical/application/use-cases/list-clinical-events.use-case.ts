import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface ListClinicalEventsQuery {
  recordId: string;
}

@Injectable()
export class ListClinicalEventsUseCase implements UseCase<
  ListClinicalEventsQuery,
  ClinicalEvent[]
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ recordId }: ListClinicalEventsQuery): Promise<ClinicalEvent[]> {
    const record = await this.records.findById(recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(recordId);
    }

    return this.records.listEvents(recordId);
  }
}
