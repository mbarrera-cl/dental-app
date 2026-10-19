import { Injectable } from '@nestjs/common';
import { TreatmentPlanRepositoryPort } from '../../../application/ports/treatment-plan-repository.port.js';
import {
  TreatmentPlanItemNotFoundError,
  TreatmentPlanNotFoundError,
} from '../../../domain/treatment-plan.errors.js';
import type {
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../../domain/treatment-plan.entity.js';

/**
 * Driven adapter: keeps treatment plans in memory for unit tests. Binding it
 * in `ClinicalModule` replaces the PostgreSQL adapter — nothing else changes.
 */
@Injectable()
export class InMemoryTreatmentPlanRepository extends TreatmentPlanRepositoryPort {
  private readonly plans = new Map<string, TreatmentPlan>();
  private readonly items = new Map<string, TreatmentPlanItem>();

  async savePlan(plan: TreatmentPlan): Promise<void> {
    this.plans.set(plan.id, plan);
  }

  async updatePlan(plan: TreatmentPlan): Promise<void> {
    if (!this.plans.has(plan.id)) {
      throw new TreatmentPlanNotFoundError(plan.id);
    }

    this.plans.set(plan.id, plan);
  }

  async findPlanByRecordId(recordId: string): Promise<TreatmentPlan | null> {
    for (const plan of this.plans.values()) {
      if (plan.recordId === recordId) {
        return plan;
      }
    }

    return null;
  }

  async findPlanById(id: string): Promise<TreatmentPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async saveItem(item: TreatmentPlanItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async updateItem(item: TreatmentPlanItem): Promise<void> {
    if (!this.items.has(item.id)) {
      throw new TreatmentPlanItemNotFoundError(item.id);
    }

    this.items.set(item.id, item);
  }

  async findItem(id: string): Promise<TreatmentPlanItem | null> {
    return this.items.get(id) ?? null;
  }

  async listItems(
    planId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<TreatmentPlanItem[]> {
    return [...this.items.values()]
      .filter((item) => item.planId === planId)
      .filter((item) => options.includeDeleted === true || !item.isDeleted)
      .sort((a, b) => a.position - b.position);
  }
}
