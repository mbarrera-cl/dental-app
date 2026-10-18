import { Entity } from '../../../shared/domain/entity.js';
import { InvalidTreatmentPlanError } from './treatment-plan.errors.js';
import { isFdiTooth } from './finding.entity.js';

export const TREATMENT_PLAN_ITEM_STATUSES = [
  'planificado',
  'en-ejecucion',
  'realizado',
  'cancelado',
] as const;

export type TreatmentPlanItemStatus =
  (typeof TREATMENT_PLAN_ITEM_STATUSES)[number];

const MAX_PROCEDURE_LENGTH = 300;
const MAX_UCO_CODE_LENGTH = 50;
const MAX_NOTES_LENGTH = 500;

/**
 * A single entry of the treatment plan: what will be done, on which tooth
 * (nullable for whole-mouth procedures), optionally priced against the UCO
 * catalog, and its execution state. Items are ordered by `position`.
 */
export class TreatmentPlanItem extends Entity<{
  planId: string;
  tooth: number | null;
  procedure: string;
  ucoCode: string | null;
  status: TreatmentPlanItemStatus;
  notes: string | null;
  position: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  statusChangedAt: Date | null;
  statusChangedBy: string | null;
}> {
  private constructor(
    props: {
      planId: string;
      tooth: number | null;
      procedure: string;
      ucoCode: string | null;
      status: TreatmentPlanItemStatus;
      notes: string | null;
      position: number;
      createdBy: string | null;
      updatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      statusChangedAt: Date | null;
      statusChangedBy: string | null;
    },
    id?: string,
  ) {
    super(props, id);
  }

  static create({
    planId,
    tooth,
    procedure,
    ucoCode,
    notes,
    position,
    createdBy,
  }: {
    planId: string;
    tooth?: number | null;
    procedure: string;
    ucoCode?: string | null;
    notes?: string | null;
    position: number;
    createdBy: string | null;
  }): TreatmentPlanItem {
    const now = new Date();

    return new TreatmentPlanItem({
      planId: requireText(planId, 'planId', 100),
      tooth: normalizeTooth(tooth),
      procedure: requireText(procedure, 'procedure', MAX_PROCEDURE_LENGTH),
      ucoCode: normalizeText(ucoCode, 'ucoCode', MAX_UCO_CODE_LENGTH),
      status: 'planificado',
      notes: normalizeText(notes, 'notes', MAX_NOTES_LENGTH),
      position: normalizePosition(position),
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
      statusChangedAt: null,
      statusChangedBy: null,
    });
  }

  static reconstitute(
    props: {
      planId: string;
      tooth: number | null;
      procedure: string;
      ucoCode: string | null;
      status: TreatmentPlanItemStatus;
      notes: string | null;
      position: number;
      createdBy: string | null;
      updatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      statusChangedAt: Date | null;
      statusChangedBy: string | null;
    },
    id: string,
  ): TreatmentPlanItem {
    return new TreatmentPlanItem(props, id);
  }

  get planId(): string {
    return this.props.planId;
  }

  get tooth(): number | null {
    return this.props.tooth;
  }

  get procedure(): string {
    return this.props.procedure;
  }

  get ucoCode(): string | null {
    return this.props.ucoCode;
  }

  get status(): TreatmentPlanItemStatus {
    return this.props.status;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get position(): number {
    return this.props.position;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get statusChangedAt(): Date | null {
    return this.props.statusChangedAt;
  }

  get statusChangedBy(): string | null {
    return this.props.statusChangedBy;
  }

  changeDetails({
    tooth,
    procedure,
    ucoCode,
    notes,
  }: {
    tooth?: number | null;
    procedure?: string;
    ucoCode?: string | null;
    notes?: string | null;
  }): void {
    if (tooth !== undefined) {
      this.props.tooth = normalizeTooth(tooth);
    }

    if (procedure !== undefined) {
      this.props.procedure = requireText(
        procedure,
        'procedure',
        MAX_PROCEDURE_LENGTH,
      );
    }

    if (ucoCode !== undefined) {
      this.props.ucoCode = normalizeText(
        ucoCode,
        'ucoCode',
        MAX_UCO_CODE_LENGTH,
      );
    }

    if (notes !== undefined) {
      this.props.notes = normalizeText(notes, 'notes', MAX_NOTES_LENGTH);
    }
  }

  /** Advances the execution state, recording who/when it changed. */
  changeStatus(
    status: string,
    actorId: string | null,
    when: Date = new Date(),
  ): void {
    const normalized = normalizeStatus(status);

    if (normalized !== this.props.status) {
      this.props.status = normalized;
      this.props.statusChangedAt = when;
      this.props.statusChangedBy = actorId;
    }
  }

  touch(actorId: string | null, when: Date = new Date()): void {
    this.props.updatedBy = actorId;
    this.props.updatedAt = when;
  }
}

/** Aggregate root: one treatment plan per clinical record. */
export class TreatmentPlan extends Entity<{
  recordId: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  private constructor(
    props: { recordId: string; createdAt: Date; updatedAt: Date },
    id?: string,
  ) {
    super(props, id);
  }

  static create(recordId: string): TreatmentPlan {
    const now = new Date();

    return new TreatmentPlan({
      recordId: requireText(recordId, 'recordId', 100),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(
    props: { recordId: string; createdAt: Date; updatedAt: Date },
    id: string,
  ): TreatmentPlan {
    return new TreatmentPlan(props, id);
  }

  get recordId(): string {
    return this.props.recordId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function requireText(value: string, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new InvalidTreatmentPlanError(`"${field}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidTreatmentPlanError(`"${field}" must not be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new InvalidTreatmentPlanError(
      `"${field}" must have at most ${maxLength} characters`,
    );
  }

  return trimmed;
}

function normalizeText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value.trim() === '' ? null : requireText(value, field, maxLength);
}

function normalizeTooth(tooth: number | null | undefined): number | null {
  if (tooth === null || tooth === undefined) {
    return null;
  }

  if (!isFdiTooth(tooth)) {
    throw new InvalidTreatmentPlanError(
      `"${tooth}" is not an FDI tooth (permanent 11–48, primary 51–85)`,
    );
  }

  return tooth;
}

function normalizePosition(position: number): number {
  if (!Number.isInteger(position) || position < 0) {
    throw new InvalidTreatmentPlanError(
      '"position" must be a non-negative integer',
    );
  }

  return position;
}

function normalizeStatus(status: string): TreatmentPlanItemStatus {
  if (!(TREATMENT_PLAN_ITEM_STATUSES as readonly string[]).includes(status)) {
    throw new InvalidTreatmentPlanError(`unknown status "${status}"`);
  }

  return status as TreatmentPlanItemStatus;
}
