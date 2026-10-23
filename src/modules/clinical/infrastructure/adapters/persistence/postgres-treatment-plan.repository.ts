import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { TreatmentPlanRepositoryPort } from '../../../application/ports/treatment-plan-repository.port.js';
import {
  TreatmentPlanItemNotFoundError,
  TreatmentPlanNotFoundError,
} from '../../../domain/treatment-plan.errors.js';
import {
  TreatmentPlan,
  TreatmentPlanItem,
  type TreatmentPlanItemStatus,
} from '../../../domain/treatment-plan.entity.js';

interface TreatmentPlanRow {
  id: string;
  record_id: string;
  notes: string | null;
  notes_updated_at: Date | null;
  notes_updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TreatmentPlanItemRow {
  id: string;
  plan_id: string;
  tooth: number | null;
  procedure: string;
  uco_code: string | null;
  status: string;
  notes: string | null;
  position: number;
  source_quote_item_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  status_changed_at: Date | null;
  status_changed_by: string | null;
  realizado_at: Date | null;
  realizado_by: string | null;
  notes_updated_at: Date | null;
  notes_updated_by: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  deleted_reason: string | null;
}

@Injectable()
export class PostgresTreatmentPlanRepository extends TreatmentPlanRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async savePlan(plan: TreatmentPlan): Promise<void> {
    await this.db.execute(
      `INSERT INTO treatment_plans (
         id, record_id, notes, notes_updated_at, notes_updated_by,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        plan.id,
        plan.recordId,
        plan.notes,
        plan.notesUpdatedAt,
        plan.notesUpdatedBy,
        plan.createdAt,
        plan.updatedAt,
      ],
    );
  }

  async updatePlan(plan: TreatmentPlan): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE treatment_plans SET
         notes = $1, notes_updated_at = $2, notes_updated_by = $3, updated_at = $4
       WHERE id = $5`,
      [
        plan.notes,
        plan.notesUpdatedAt,
        plan.notesUpdatedBy,
        plan.updatedAt,
        plan.id,
      ],
    );

    if (changed === 0) {
      throw new TreatmentPlanNotFoundError(plan.id);
    }
  }

  async findPlanByRecordId(recordId: string): Promise<TreatmentPlan | null> {
    if (!isUuid(recordId)) {
      return null;
    }

    const row = await this.db.queryOne<TreatmentPlanRow>(
      'SELECT * FROM treatment_plans WHERE record_id = $1',
      [recordId],
    );

    return row === null ? null : toDomainPlan(row);
  }

  async findPlanById(id: string): Promise<TreatmentPlan | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<TreatmentPlanRow>(
      'SELECT * FROM treatment_plans WHERE id = $1',
      [id],
    );

    return row === null ? null : toDomainPlan(row);
  }

  async saveItem(item: TreatmentPlanItem): Promise<void> {
    await this.db.execute(
      `INSERT INTO treatment_plan_items (
         id, plan_id, tooth, procedure, uco_code, status, notes, position,
         source_quote_item_id, created_by, updated_by, created_at, updated_at,
         status_changed_at, status_changed_by, realizado_at, realizado_by,
         notes_updated_at, notes_updated_by,
         deleted_at, deleted_by, deleted_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        item.id,
        item.planId,
        item.tooth,
        item.procedure,
        item.ucoCode,
        item.status,
        item.notes,
        item.position,
        item.sourceQuoteItemId,
        item.createdBy,
        item.updatedBy,
        item.createdAt,
        item.updatedAt,
        item.statusChangedAt,
        item.statusChangedBy,
        item.realizadoAt,
        item.realizadoBy,
        item.notesUpdatedAt,
        item.notesUpdatedBy,
        item.deletedAt,
        item.deletedBy,
        item.deletedReason,
      ],
    );
  }

  async updateItem(item: TreatmentPlanItem): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE treatment_plan_items SET
         tooth = $1, procedure = $2, uco_code = $3, status = $4, notes = $5,
         updated_by = $6, updated_at = $7,
         status_changed_at = $8, status_changed_by = $9,
         realizado_at = $10, realizado_by = $11,
         notes_updated_at = $12, notes_updated_by = $13,
         deleted_at = $14, deleted_by = $15, deleted_reason = $16
       WHERE id = $17`,
      [
        item.tooth,
        item.procedure,
        item.ucoCode,
        item.status,
        item.notes,
        item.updatedBy,
        item.updatedAt,
        item.statusChangedAt,
        item.statusChangedBy,
        item.realizadoAt,
        item.realizadoBy,
        item.notesUpdatedAt,
        item.notesUpdatedBy,
        item.deletedAt,
        item.deletedBy,
        item.deletedReason,
        item.id,
      ],
    );

    if (changed === 0) {
      throw new TreatmentPlanItemNotFoundError(item.id);
    }
  }

  async findItem(id: string): Promise<TreatmentPlanItem | null> {
    if (!isUuid(id)) {
      return null;
    }

    const row = await this.db.queryOne<TreatmentPlanItemRow>(
      'SELECT * FROM treatment_plan_items WHERE id = $1',
      [id],
    );

    return row === null ? null : toDomainItem(row);
  }

  async listItems(
    planId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<TreatmentPlanItem[]> {
    if (!isUuid(planId)) {
      return [];
    }

    const deletedFilter = options.includeDeleted === true ? '' : 'AND deleted_at IS NULL';

    const rows = await this.db.query<TreatmentPlanItemRow>(
      `SELECT * FROM treatment_plan_items
       WHERE plan_id = $1 ${deletedFilter}
       ORDER BY position ASC, created_at ASC, id ASC`,
      [planId],
    );

    return rows.map((row) => toDomainItem(row));
  }
}

function toDomainPlan(row: TreatmentPlanRow): TreatmentPlan {
  return TreatmentPlan.reconstitute(
    {
      recordId: row.record_id,
      notes: row.notes,
      notesUpdatedAt:
        row.notes_updated_at === null ? null : new Date(row.notes_updated_at),
      notesUpdatedBy: row.notes_updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    },
    row.id,
  );
}

function toDomainItem(row: TreatmentPlanItemRow): TreatmentPlanItem {
  return TreatmentPlanItem.reconstitute(
    {
      planId: row.plan_id,
      tooth: row.tooth,
      procedure: row.procedure,
      ucoCode: row.uco_code,
      status: row.status as TreatmentPlanItemStatus,
      notes: row.notes,
      position: row.position,
      sourceQuoteItemId: row.source_quote_item_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      statusChangedAt:
        row.status_changed_at === null ? null : new Date(row.status_changed_at),
      statusChangedBy: row.status_changed_by,
      realizadoAt:
        row.realizado_at === null ? null : new Date(row.realizado_at),
      realizadoBy: row.realizado_by,
      notesUpdatedAt:
        row.notes_updated_at === null ? null : new Date(row.notes_updated_at),
      notesUpdatedBy: row.notes_updated_by,
      deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
      deletedBy: row.deleted_by,
      deletedReason: row.deleted_reason,
    },
    row.id,
  );
}
