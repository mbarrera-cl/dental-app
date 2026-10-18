import { Injectable } from '@nestjs/common';
import {
  PostgresDatabase,
  isUuid,
} from '../../../../../shared/infrastructure/database/postgres-database.js';
import { TreatmentPlanRepositoryPort } from '../../../application/ports/treatment-plan-repository.port.js';
import { TreatmentPlanItemNotFoundError } from '../../../domain/treatment-plan.errors.js';
import {
  TreatmentPlan,
  TreatmentPlanItem,
  type TreatmentPlanItemStatus,
} from '../../../domain/treatment-plan.entity.js';

interface TreatmentPlanRow {
  id: string;
  record_id: string;
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
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  status_changed_at: Date | null;
  status_changed_by: string | null;
}

@Injectable()
export class PostgresTreatmentPlanRepository extends TreatmentPlanRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async savePlan(plan: TreatmentPlan): Promise<void> {
    await this.db.execute(
      `INSERT INTO treatment_plans (id, record_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4)`,
      [plan.id, plan.recordId, plan.createdAt, plan.updatedAt],
    );
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
         created_by, updated_by, created_at, updated_at,
         status_changed_at, status_changed_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        item.id,
        item.planId,
        item.tooth,
        item.procedure,
        item.ucoCode,
        item.status,
        item.notes,
        item.position,
        item.createdBy,
        item.updatedBy,
        item.createdAt,
        item.updatedAt,
        item.statusChangedAt,
        item.statusChangedBy,
      ],
    );
  }

  async updateItem(item: TreatmentPlanItem): Promise<void> {
    const changed = await this.db.execute(
      `UPDATE treatment_plan_items SET
         tooth = $1, procedure = $2, uco_code = $3, status = $4, notes = $5,
         updated_by = $6, updated_at = $7,
         status_changed_at = $8, status_changed_by = $9
       WHERE id = $10`,
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

  async listItems(planId: string): Promise<TreatmentPlanItem[]> {
    if (!isUuid(planId)) {
      return [];
    }

    const rows = await this.db.query<TreatmentPlanItemRow>(
      'SELECT * FROM treatment_plan_items WHERE plan_id = $1 ORDER BY position ASC, created_at ASC, id ASC',
      [planId],
    );

    return rows.map((row) => toDomainItem(row));
  }
}

function toDomainPlan(row: TreatmentPlanRow): TreatmentPlan {
  return TreatmentPlan.reconstitute(
    {
      recordId: row.record_id,
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
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      statusChangedAt:
        row.status_changed_at === null ? null : new Date(row.status_changed_at),
      statusChangedBy: row.status_changed_by,
    },
    row.id,
  );
}
