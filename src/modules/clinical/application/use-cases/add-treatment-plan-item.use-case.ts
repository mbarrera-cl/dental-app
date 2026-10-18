import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalRecordLockedError,
  ClinicalRecordNotFoundError,
} from '../../domain/clinical.errors.js';
import {
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';

export interface AddTreatmentPlanItemCommand {
  recordId: string;
  actorId: string | null;
  tooth?: number | null;
  procedure: string;
  ucoCode?: string | null;
  notes?: string | null;
}

/**
 * Adds one entry to the treatment plan of a clinical record, creating the
 * plan lazily on first use. The record must still be a draft (finalized
 * records are locked).
 */
@Injectable()
export class AddTreatmentPlanItemUseCase implements UseCase<
  AddTreatmentPlanItemCommand,
  TreatmentPlanItem
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
  ) {}

  async execute(
    command: AddTreatmentPlanItemCommand,
  ): Promise<TreatmentPlanItem> {
    const record = await this.records.findById(command.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(command.recordId);
    }

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    const plan = await this.getOrCreatePlan(record.id);
    const existing = await this.plans.listItems(plan.id);

    const item = TreatmentPlanItem.create({
      planId: plan.id,
      tooth: command.tooth,
      procedure: command.procedure,
      ucoCode: command.ucoCode,
      notes: command.notes,
      position: existing.length,
      createdBy: command.actorId,
    });

    await this.plans.saveItem(item);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'plan-item-agregado',
        summary: `Plan: ${item.procedure}${item.tooth === null ? '' : ` (pieza ${item.tooth})`}`,
        payload: {
          itemId: item.id,
          tooth: item.tooth,
          procedure: item.procedure,
          status: item.status,
        },
      }),
    );

    return item;
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
