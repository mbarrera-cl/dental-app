import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import {
  ClinicalRecordLockedError,
  ClinicalRecordNotFoundError,
} from '../../domain/clinical.errors.js';
import {
  EmptyTreatmentPlanItemUpdateError,
  TreatmentPlanItemNotFoundError,
} from '../../domain/treatment-plan.errors.js';
import type { TreatmentPlanItem } from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';

export interface UpdateTreatmentPlanItemCommand {
  itemId: string;
  actorId: string | null;
  status?: string;
  tooth?: number | null;
  procedure?: string;
  ucoCode?: string | null;
  notes?: string | null;
}

/**
 * Partial update of a treatment plan entry (status and/or details). The
 * owning record must still be a draft.
 */
@Injectable()
export class UpdateTreatmentPlanItemUseCase implements UseCase<
  UpdateTreatmentPlanItemCommand,
  TreatmentPlanItem
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
  ) {}

  async execute(
    command: UpdateTreatmentPlanItemCommand,
  ): Promise<TreatmentPlanItem> {
    const item = await this.plans.findItem(command.itemId);

    if (item === null) {
      throw new TreatmentPlanItemNotFoundError(command.itemId);
    }

    const record = await this.loadRecord(item.planId);

    const hasChanges =
      command.status !== undefined ||
      command.tooth !== undefined ||
      command.procedure !== undefined ||
      command.ucoCode !== undefined ||
      command.notes !== undefined;

    if (!hasChanges) {
      throw new EmptyTreatmentPlanItemUpdateError();
    }

    if (command.status !== undefined) {
      item.changeStatus(command.status, command.actorId);
    }

    item.changeDetails({
      tooth: command.tooth,
      procedure: command.procedure,
      ucoCode: command.ucoCode,
      notes: command.notes,
    });
    item.touch(command.actorId);

    await this.plans.updateItem(item);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'plan-item-actualizado',
        summary: `Plan actualizado: ${item.procedure}${item.tooth === null ? '' : ` (pieza ${item.tooth})`}`,
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

  private async loadRecord(planId: string) {
    const plan = await this.plans.findPlanById(planId);

    if (plan === null) {
      throw new ClinicalRecordNotFoundError(planId);
    }

    const record = await this.records.findById(plan.recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(plan.recordId);
    }

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    return record;
  }
}
