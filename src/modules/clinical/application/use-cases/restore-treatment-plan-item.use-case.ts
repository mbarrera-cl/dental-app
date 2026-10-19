import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import { ClinicalRecordLockedError } from '../../domain/clinical.errors.js';
import type { TreatmentPlanItem } from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';
import { loadPlanItemContext } from './plan-item-context.js';

export interface RestoreTreatmentPlanItemCommand {
  itemId: string;
  actorId: string | null;
}

/**
 * Brings a treatment plan entry back from the trash. Blocked once the record
 * is finalized.
 */
@Injectable()
export class RestoreTreatmentPlanItemUseCase implements UseCase<
  RestoreTreatmentPlanItemCommand,
  TreatmentPlanItem
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
  ) {}

  async execute(
    command: RestoreTreatmentPlanItemCommand,
  ): Promise<TreatmentPlanItem> {
    const { item, record } = await loadPlanItemContext(
      this.plans,
      this.records,
      command.itemId,
      { includeDeleted: true },
    );

    if (!record.isDraft) {
      throw new ClinicalRecordLockedError(record.id);
    }

    item.restore(command.actorId);
    await this.plans.updateItem(item);

    await this.records.appendEvent(
      ClinicalEvent.create({
        patientId: record.patientId,
        recordId: record.id,
        actorId: command.actorId,
        action: 'plan-item-restaurado',
        summary: `Plan restaurado: ${item.procedure}`,
        payload: { itemId: item.id },
      }),
    );

    return item;
  }
}
