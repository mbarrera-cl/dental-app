import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface GetClinicalRecordQuery {
  id: string;
}

@Injectable()
export class GetClinicalRecordUseCase implements UseCase<
  GetClinicalRecordQuery,
  FichaClinica
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ id }: GetClinicalRecordQuery): Promise<FichaClinica> {
    const record = await this.records.findById(id);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(id);
    }

    return record;
  }
}
