import type {
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../domain/treatment-plan.entity.js';

/**
 * Driven port for the treatment plan context. A plan is one-per-record; items
 * are appended and edited in place. Items are only soft-deleted (with a
 * reason) so they can be restored, never removed physically here.
 */
export abstract class TreatmentPlanRepositoryPort {
  abstract savePlan(plan: TreatmentPlan): Promise<void>;

  /** Updates an existing plan; throws when it no longer exists. */
  abstract updatePlan(plan: TreatmentPlan): Promise<void>;

  abstract findPlanByRecordId(recordId: string): Promise<TreatmentPlan | null>;

  abstract findPlanById(id: string): Promise<TreatmentPlan | null>;

  abstract saveItem(item: TreatmentPlanItem): Promise<void>;

  abstract updateItem(item: TreatmentPlanItem): Promise<void>;

  abstract findItem(id: string): Promise<TreatmentPlanItem | null>;

  /**
   * Every item of a plan, ordered by position. Deleted items are excluded
   * unless `includeDeleted` is set (the trash view).
   */
  abstract listItems(
    planId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<TreatmentPlanItem[]>;
}
