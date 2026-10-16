import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { Patient } from '../../domain/patient.entity.js';
import { PatientRutNotFoundError } from '../../domain/patient.errors.js';
import { Rut } from '../../domain/rut.vo.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

export interface GetPatientByRutQuery {
  rut: string;
}

@Injectable()
export class GetPatientByRutUseCase implements UseCase<
  GetPatientByRutQuery,
  Patient
> {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute({ rut }: GetPatientByRutQuery): Promise<Patient> {
    // Normalize first, so any common spelling reaches the same row (and a
    // malformed RUT fails with a validation error, not a miss).
    const normalized = Rut.create(rut).value;
    const patient = await this.patientRepository.findByRut(normalized);

    if (patient === null) {
      throw new PatientRutNotFoundError(normalized);
    }

    return patient;
  }
}
