import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalRecordLockedError,
  ClinicalRecordNotFoundError,
} from '../../domain/clinical.errors.js';
import { TreatmentPlan } from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';

export interface UpdateTreatmentPlanNotesCommand {
  recordId: string;
  actorId: string | null;
  /** Sanitized rich-text HTML; empty clears the note. */
  notes: string | null | undefined;
}

/**
 * Replaces the plan-level rich-text note. Blocked once the record is sealed.
 */
@Injectable()
export class UpdateTreatmentPlanNotesUseCase implements UseCase<
  UpdateTreatmentPlanNotesCommand,
  TreatmentPlan
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
  ) {}

  async execute(
    command: UpdateTreatmentPlanNotesCommand,
  ): Promise<TreatmentPlan> {
    const record = await this.records.findById(command.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(command.recordId);
    }

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    const plan = await this.getOrCreatePlan(record.id);

    plan.changeNotes(command.notes, command.actorId);
    await this.plans.updatePlan(plan);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'plan-nota-actualizada',
        summary: 'Nota del plan actualizada',
      }),
    );

    return plan;
  }

  private async getOrCreatePlan(recordId: string): Promise<TreatmentPlan> {
    const existing = await this.plans.findPlanByRecordId(recordId);

    if (existing !== null) {
      return existing;
    }

    const plan = TreatmentPlan.create(recordId);
    await this.plans.savePlan(plan);

    return plan;
  }
}
