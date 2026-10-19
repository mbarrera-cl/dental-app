import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import { ClinicalRecordLockedError } from '../../domain/clinical.errors.js';
import type { TreatmentPlanItem } from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';
import { loadPlanItemContext } from './plan-item-context.js';

export interface DeleteTreatmentPlanItemCommand {
  itemId: string;
  actorId: string | null;
  reason: string;
}

/**
 * Moves a treatment plan entry to the trash (soft delete) with a mandatory
 * reason. Blocked once the record is finalized.
 */
@Injectable()
export class DeleteTreatmentPlanItemUseCase implements UseCase<
  DeleteTreatmentPlanItemCommand,
  TreatmentPlanItem
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
  ) {}

  async execute(
    command: DeleteTreatmentPlanItemCommand,
  ): Promise<TreatmentPlanItem> {
    const { item, record } = await loadPlanItemContext(
      this.plans,
      this.records,
      command.itemId,
    );

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    item.softDelete(command.actorId, command.reason);
    await this.plans.updateItem(item);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'plan-item-eliminado',
        summary: `Plan eliminado: ${item.procedure}`,
        payload: {
          itemId: item.id,
          reason: item.deletedReason,
        },
      }),
    );

    return item;
  }
}
