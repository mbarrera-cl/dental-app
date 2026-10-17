import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface GetPatientClinicalRecordQuery {
  patientId: string;
}

/**
 * Used by the patient profile to know whether a ficha exists yet; a missing
 * record is a 404 for this endpoint (the UI then offers to create it), unlike
 * GET /clinical-records/:id where it means "wrong id".
 */
@Injectable()
export class GetPatientClinicalRecordUseCase implements UseCase<
  GetPatientClinicalRecordQuery,
  FichaClinica
> {
  constructor(private readonly records: ClinicalRecordRepositoryPort) {}

  async execute({ patientId }: GetPatientClinicalRecordQuery): Promise<FichaClinica> {
    const record = await this.records.findByPatientId(patientId);

    if (record === null) {
      throw new PatientClinicalRecordNotFoundError(patientId);
    }

    return record;
  }
}
