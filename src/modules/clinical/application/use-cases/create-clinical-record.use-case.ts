import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import { suggestCategoriaEtaria } from '../../domain/categoria-etaria.js';
import { ClinicalRecordAlreadyExistsError } from '../../domain/clinical.errors.js';
import { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';

export interface CreateClinicalRecordCommand {
  patientId: string;
  actorId: string | null;
  /** Manual override; omitted means "suggest from the patient's age". */
  categoria?: string;
  embarazada?: boolean;
}

/**
 * Opens the (single) clinical record of a patient. The age category is
 * preselected from the birth date — `5-14-no-programado` is never suggested
 * because it depends on the appointment, not on the age.
 */
@Injectable()
export class CreateClinicalRecordUseCase implements UseCase<
  CreateClinicalRecordCommand,
  FichaClinica
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: CreateClinicalRecordCommand): Promise<FichaClinica> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const existing = await this.records.findByPatientId(command.patientId);

    if (existing !== null) {
      throw new ClinicalRecordAlreadyExistsError(command.patientId);
    }

    const record = FichaClinica.create({
      patientId: command.patientId,
      categoria:
        command.categoria ?? suggestCategoriaEtaria(patient.fechaNacimiento),
      embarazada: command.embarazada ?? false,
      createdBy: command.actorId,
    });

    await this.records.save(record);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'ficha-creada',
        summary: `Ficha clínica abierta (${record.categoria})`,
        payload: { categoria: record.categoria },
      }),
    );

    return record;
  }
}
