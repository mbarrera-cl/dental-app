import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { Patient } from '../../domain/patient.entity.js';
import { PatientNotFoundError } from '../../domain/patient.errors.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

export interface GetPatientQuery {
  id: string;
}

@Injectable()
export class GetPatientUseCase implements UseCase<GetPatientQuery, Patient> {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute({ id }: GetPatientQuery): Promise<Patient> {
    const patient = await this.patientRepository.findById(id);

    if (patient === null) {
      throw new PatientNotFoundError(id);
    }

    return patient;
  }
}
