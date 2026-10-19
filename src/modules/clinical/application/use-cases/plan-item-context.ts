import type { FichaClinica } from '../../domain/ficha-clinica.entity.js';
import { ClinicalRecordNotFoundError } from '../../domain/clinical.errors.js';
import {
  TreatmentPlanItemNotFoundError,
  TreatmentPlanNotFoundError,
} from '../../domain/treatment-plan.errors.js';
import type {
  TreatmentPlan,
  TreatmentPlanItem,
} from '../../domain/treatment-plan.entity.js';
import type { ClinicalRecordRepositoryPort } from '../ports/clinical-record-repository.port.js';
import type { TreatmentPlanRepositoryPort } from '../ports/treatment-plan-repository.port.js';

export interface PlanItemContext {
  plan: TreatmentPlan;
  item: TreatmentPlanItem;
  record: FichaClinica;
}

/**
 * Loads a plan item together with its plan and owning record. Trashed items
 * are treated as missing for the editing use cases (they must be restored
 * first); `includeDeleted` keeps them visible to the trash use cases.
 */
export async function loadPlanItemContext(
  plans: TreatmentPlanRepositoryPort,
  records: ClinicalRecordRepositoryPort,
  itemId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<PlanItemContext> {
  const item = await plans.findItem(itemId);

  if (item === null || (item.isDeleted && options.includeDeleted !== true)) {
    throw new TreatmentPlanItemNotFoundError(itemId);
  }

  const plan = await plans.findPlanById(item.planId);

  if (plan === null) {
    throw new TreatmentPlanNotFoundError(item.planId);
  }

  const record = await records.findById(plan.recordId);

  if (record === null) {
    throw new ClinicalRecordNotFoundError(plan.recordId);
  }

  return { plan, item, record };
}
