import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { PatientRepositoryPort } from '../../../patients/application/ports/patient-repository.port.js';
import { PatientNotFoundError } from '../../../patients/domain/patient.errors.js';
import { ConsentRecord } from '../../domain/consent-record.entity.js';
import { normalizeConsentKey } from '../../domain/consent-template.entity.js';
import {
  ConsentTemplateNotFoundError,
  InvalidConsentError,
} from '../../domain/consent.errors.js';
import { ConsentRecordRepositoryPort } from '../ports/consent-record-repository.port.js';
import { ConsentTemplateRepositoryPort } from '../ports/consent-template-repository.port.js';

export interface RecordConsentCommand {
  patientId: string;
  templateKey: string;
  procedure?: string | null;
  acceptorName: string;
  actorId: string | null;
}

/**
 * Records a simple digital acceptance: the patient (or their responsible
 * adult) types their name and the system freezes the template version,
 * title and body into an append-only record.
 */
@Injectable()
export class RecordConsentUseCase implements UseCase<
  RecordConsentCommand,
  ConsentRecord
> {
  constructor(
    private readonly records: ConsentRecordRepositoryPort,
    private readonly templates: ConsentTemplateRepositoryPort,
    private readonly patients: PatientRepositoryPort,
  ) {}

  async execute(command: RecordConsentCommand): Promise<ConsentRecord> {
    const patient = await this.patients.findById(command.patientId);

    if (patient === null) {
      throw new PatientNotFoundError(command.patientId);
    }

    const template = await this.templates.findByKey(
      normalizeConsentKey(command.templateKey),
    );

    if (template === null) {
      throw new ConsentTemplateNotFoundError(command.templateKey);
    }

    if (!template.active) {
      throw new InvalidConsentError(`template "${template.key}" is inactive`);
    }

    const record = ConsentRecord.create({
      template,
      patientId: patient.id,
      patientName: patient.nombreCompleto,
      patientRut: patient.rut,
      procedure: command.procedure ?? null,
      acceptorName: command.acceptorName,
      recordedBy: command.actorId,
    });

    await this.records.append(record);

    return record;
  }
}
