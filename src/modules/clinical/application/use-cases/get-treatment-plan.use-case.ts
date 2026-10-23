import { Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import {
  TreatmentPlan,
  type TreatmentPlanItem,
} from '../../domain/treatment-plan.entity.js';
import { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';

export interface GetTreatmentPlanQuery {
  recordId: string;
  /** `true` returns the trash (soft-deleted items) instead of the active plan. */
  deleted?: boolean;
}

export interface TreatmentPlanView {
  plan: TreatmentPlan;
  items: TreatmentPlanItem[];
}

/**
 * Returns the treatment plan of a clinical record, creating the plan lazily
 * on first access (a record may exist before any plan entry is added). With
 * `deleted` it returns the trash instead of the active items.
 */
@Injectable()
export class GetTreatmentPlanUseCase implements UseCase<
  GetTreatmentPlanQuery,
  TreatmentPlanView
> {
  constructor(
    private readonly records: ClinicalRecordRepositoryPort,
    private readonly plans: TreatmentPlanRepositoryPort,
  ) {}

  async execute({
    recordId,
    deleted = false,
  }: GetTreatmentPlanQuery): Promise<TreatmentPlanView> {
    const record = await this.records.findById(recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(recordId);
    }

    const plan = await this.getOrCreatePlan(recordId);
    const all = await this.plans.listItems(plan.id, { includeDeleted: true });
    const items = deleted ? all.filter((item) => item.isDeleted) : all.filter((item) => !item.isDeleted);

    return { plan, items };
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
