import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PatientRepositoryPort } from '../../application/ports/patient-repository.port.js';

/**
 * Assigns a clinical record number to patients created before the numbering
 * feature existed. New patients get theirs in `CreatePatientUseCase`; this
 * backfill is idempotent, runs once per boot, and is a no-op when nothing is
 * missing. Numbers follow creation order.
 */
@Injectable()
export class PatientNumberBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PatientNumberBootstrapService.name);

  constructor(private readonly patients: PatientRepositoryPort) {}

  async onApplicationBootstrap(): Promise<void> {
    const pending = await this.patients.findWithoutNumeroHistoria();

    if (pending.length === 0) {
      return;
    }

    for (const patient of pending) {
      patient.changeNumeroHistoria(await this.patients.nextNumeroHistoria());
      await this.patients.update(patient);
    }

    this.logger.log(
      `Assigned numero de historia to ${pending.length} existing patient(s)`,
    );
  }
}
