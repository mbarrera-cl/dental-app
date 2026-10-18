import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Prescription } from '../../domain/prescription.entity.js';
import { PrescriptionNotFoundError } from '../../domain/prescription.errors.js';
import { PrescriptionRepositoryPort } from '../ports/prescription-repository.port.js';

export interface GetPrescriptionCommand {
  id: string;
}

@Injectable()
export class GetPrescriptionUseCase implements UseCase<
  GetPrescriptionCommand,
  Prescription
> {
  constructor(private readonly prescriptions: PrescriptionRepositoryPort) {}

  async execute({ id }: GetPrescriptionCommand): Promise<Prescription> {
    const prescription = await this.prescriptions.findById(id);

    if (prescription === null) {
      throw new PrescriptionNotFoundError(id);
    }

    return prescription;
  }
}
