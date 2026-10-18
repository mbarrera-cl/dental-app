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
}

export interface TreatmentPlanView {
  plan: TreatmentPlan;
  items: TreatmentPlanItem[];
}

/**
 * Returns the treatment plan of a clinical record, creating the plan lazily
 * on first access (a record may exist before any plan entry is added).
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
  }: GetTreatmentPlanQuery): Promise<TreatmentPlanView> {
    const record = await this.records.findById(recordId);

    if (record === null) {
      throw new ClinicalRecordNotFoundError(recordId);
    }

    const plan = await this.getOrCreatePlan(recordId);
    const items = await this.plans.listItems(plan.id);

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
