import type {
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../domain/treatment-plan.entity.js';

/**
 * Driven port for the treatment plan context. A plan is one-per-record; items
 * are appended and edited in place (status transitions are audited, never
 * deleted).
 */
export abstract class TreatmentPlanRepositoryPort {
  abstract savePlan(plan: TreatmentPlan): Promise<void>;

  abstract findPlanByRecordId(recordId: string): Promise<TreatmentPlan | null>;

  abstract findPlanById(id: string): Promise<TreatmentPlan | null>;

  abstract saveItem(item: TreatmentPlanItem): Promise<void>;

  abstract updateItem(item: TreatmentPlanItem): Promise<void>;

  abstract findItem(id: string): Promise<TreatmentPlanItem | null>;

  /** Every item of a plan, ordered by position. */
  abstract listItems(planId: string): Promise<TreatmentPlanItem[]>;
}
