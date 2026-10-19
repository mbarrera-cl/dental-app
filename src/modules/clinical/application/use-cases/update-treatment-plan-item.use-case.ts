import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalEvent } from '../../domain/clinical-event.entity.js';
import { ClinicalRecordLockedError } from '../../domain/clinical.errors.js';
import {
  EmptyTreatmentPlanItemUpdateError,
} from '../../domain/treatment-plan.errors.js';
import type { TreatmentPlanItem } from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';
import { loadPlanItemContext } from './plan-item-context.js';

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
 * Partial update of a treatment plan entry. Once the record is finalized only
 * the execution `status` (and its completion date) may change; editing details
 * or notes is rejected with `ClinicalRecordLockedError` (HTTP 423).
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
    const { item, record } = await loadPlanItemContext(
      this.plans,
      this.records,
      command.itemId,
    );

    const hasDetails =
      command.tooth !== undefined ||
      command.procedure !== undefined ||
      command.ucoCode !== undefined;
    const hasNotes = command.notes !== undefined;
    const hasStatus = command.status !== undefined;

    if (!hasStatus && !hasDetails && !hasNotes) {
      throw new EmptyTreatmentPlanItemUpdateError();
    }

    if (!record.isDraft && (hasDetails || hasNotes)) {
      throw new ClinicalRecordLockedError(record.id);
    }

    if (hasStatus) {
      item.changeStatus(command.status as string, command.actorId);
    }

    if (hasDetails) {
      item.changeDetails({
        tooth: command.tooth,
        procedure: command.procedure,
        ucoCode: command.ucoCode,
      });
    }

    if (hasNotes) {
      item.changeNotes(command.notes, command.actorId);
    }

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
}
