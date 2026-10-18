import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import {
  Prescription,
  type PrescriptionItemInput,
} from '../../domain/prescription.entity.js';
import { PrescriptionRepositoryPort } from '../ports/prescription-repository.port.js';

export interface CreatePrescriptionCommand {
  patientId: string;
  items: PrescriptionItemInput[];
  indicaciones?: string | null;
  actorId: string | null;
  actorName: string;
}

/**
 * Issues a prescription for an existing patient. The patient name and RUT are
 * snapshotted into the document, exactly like a quotation does.
 */
@Injectable()
export class CreatePrescriptionUseCase implements UseCase<
  CreatePrescriptionCommand,
  Prescription
> {
  constructor(
    private readonly prescriptions: PrescriptionRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: CreatePrescriptionCommand): Promise<Prescription> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const prescription = Prescription.create({
      patientId: patient.id,
      patientName: patient.nombreCompleto,
      patientRut: patient.rut,
      items: command.items,
      indicaciones: command.indicaciones ?? null,
      issuedBy: command.actorId,
      issuedByName: command.actorName,
    });

    await this.prescriptions.save(prescription);

    return prescription;
  }
}
