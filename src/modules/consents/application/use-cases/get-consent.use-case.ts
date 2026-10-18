import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ConsentRecord } from '../../domain/consent-record.entity.js';
import { ConsentRecordNotFoundError } from '../../domain/consent.errors.js';
import { ConsentRecordRepositoryPort } from '../ports/consent-record-repository.port.js';

export interface GetConsentCommand {
  id: string;
}

@Injectable()
export class GetConsentUseCase implements UseCase<
  GetConsentCommand,
  ConsentRecord
> {
  constructor(private readonly records: ConsentRecordRepositoryPort) {}

  async execute({ id }: GetConsentCommand): Promise<ConsentRecord> {
    const record = await this.records.findById(id);

    if (record === null) {
      throw new ConsentRecordNotFoundError(id);
    }

    return record;
  }
}
