import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { Patient } from '../../domain/patient.entity.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

@Injectable()
export class ListPatientsUseCase implements UseCase<void, Patient[]> {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute(): Promise<Patient[]> {
    return this.patientRepository.findAll();
  }
}
