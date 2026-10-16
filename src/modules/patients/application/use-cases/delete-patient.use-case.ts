import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientNotFoundError } from '../../domain/patient.errors.js';
import { PatientRepositoryPort } from '../ports/patient-repository.port.js';

export interface DeletePatientCommand {
  id: string;
}

@Injectable()
export class DeletePatientUseCase implements UseCase<
  DeletePatientCommand,
  void
> {
  constructor(private readonly patientRepository: PatientRepositoryPort) {}

  async execute({ id }: DeletePatientCommand): Promise<void> {
    const patient = await this.patientRepository.findById(id);

    if (patient === null) {
      throw new PatientNotFoundError(id);
    }

    await this.patientRepository.delete(id);
  }
}
