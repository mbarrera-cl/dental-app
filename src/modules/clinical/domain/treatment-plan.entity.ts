import { Entity } from '../../../shared/domain/entity.js';
import { isEmptyRichText, sanitizeRichText } from '../../../shared/domain/rich-text.js';
import {
  InvalidTreatmentPlanError,
  TreatmentPlanItemAlreadyDeletedError,
  TreatmentPlanItemNotDeletedError,
} from './treatment-plan.errors.js';
import { isFdiTooth } from './finding.entity.js';

export const TREATMENT_PLAN_ITEM_STATUSES = [
  'pendiente',
  'realizado',
  'cancelado',
] as const;

export type TreatmentPlanItemStatus =
  (typeof TREATMENT_PLAN_ITEM_STATUSES)[number];

const MAX_PROCEDURE_LENGTH = 300;
const MAX_UCO_CODE_LENGTH = 50;
const MAX_NOTES_LENGTH = 20_000;
const MAX_DELETE_REASON_LENGTH = 300;

/**
 * A single entry of the treatment plan: what will be done, on which tooth
 * (nullable for whole-mouth procedures), priced against the UCO catalog when
 * possible, and its execution state. Items are ordered by `position`.
 *
 * Items are never imported by hand: they come from an approved quotation (see
 * `sourceQuoteItemId`). They can be soft-deleted with a mandatory reason and
 * restored from the trash, so the clinical history is never really lost.
 */
export class TreatmentPlanItem extends Entity<{
  planId: string;
  tooth: number | null;
  procedure: string;
  ucoCode: string | null;
  status: TreatmentPlanItemStatus;
  notes: string | null;
  position: number;
  sourceQuoteItemId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  statusChangedAt: Date | null;
  statusChangedBy: string | null;
  realizadoAt: Date | null;
  realizadoBy: string | null;
  notesUpdatedAt: Date | null;
  notesUpdatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletedReason: string | null;
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
      sourceQuoteItemId: string | null;
      createdBy: string | null;
      updatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      statusChangedAt: Date | null;
      statusChangedBy: string | null;
      realizadoAt: Date | null;
      realizadoBy: string | null;
      notesUpdatedAt: Date | null;
      notesUpdatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
      deletedReason: string | null;
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
    sourceQuoteItemId,
  }: {
    planId: string;
    tooth?: number | null;
    procedure: string;
    ucoCode?: string | null;
    notes?: string | null;
    position: number;
    createdBy: string | null;
    sourceQuoteItemId?: string | null;
  }): TreatmentPlanItem {
    const now = new Date();

    return new TreatmentPlanItem({
      planId: requireText(planId, 'planId', 100),
      tooth: normalizeTooth(tooth),
      procedure: requireText(procedure, 'procedure', MAX_PROCEDURE_LENGTH),
      ucoCode: normalizeText(ucoCode, 'ucoCode', MAX_UCO_CODE_LENGTH),
      status: 'pendiente',
      notes: normalizeRichText(notes),
      position: normalizePosition(position),
      sourceQuoteItemId: normalizeText(
        sourceQuoteItemId,
        'sourceQuoteItemId',
        100,
      ),
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
      statusChangedAt: null,
      statusChangedBy: null,
      realizadoAt: null,
      realizadoBy: null,
      notesUpdatedAt: null,
      notesUpdatedBy: null,
      deletedAt: null,
      deletedBy: null,
      deletedReason: null,
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
      sourceQuoteItemId: string | null;
      createdBy: string | null;
      updatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
      statusChangedAt: Date | null;
      statusChangedBy: string | null;
      realizadoAt: Date | null;
      realizadoBy: string | null;
      notesUpdatedAt: Date | null;
      notesUpdatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
      deletedReason: string | null;
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

  get sourceQuoteItemId(): string | null {
    return this.props.sourceQuoteItemId;
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

  get realizadoAt(): Date | null {
    return this.props.realizadoAt;
  }

  get realizadoBy(): string | null {
    return this.props.realizadoBy;
  }

  get notesUpdatedAt(): Date | null {
    return this.props.notesUpdatedAt;
  }

  get notesUpdatedBy(): string | null {
    return this.props.notesUpdatedBy;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get deletedBy(): string | null {
    return this.props.deletedBy;
  }

  get deletedReason(): string | null {
    return this.props.deletedReason;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /** Changes the description/tooth of a line still in the active plan. */
  changeDetails({
    tooth,
    procedure,
    ucoCode,
  }: {
    tooth?: number | null;
    procedure?: string;
    ucoCode?: string | null;
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
  }

  /**
   * Replaces the rich-text note (sanitized) and records who/when. An empty
   * note is stored as `null`.
   */
  changeNotes(
    notes: string | null | undefined,
    actorId: string | null,
    when: Date = new Date(),
  ): void {
    this.props.notes = normalizeRichText(notes);
    this.props.notesUpdatedAt = when;
    this.props.notesUpdatedBy = actorId;
  }

  /**
   * Advances the execution state, recording who/when it changed. Marking the
   * item as `realizado` also stores the completion date/author; leaving that
   * state clears them.
   */
  changeStatus(
    status: string,
    actorId: string | null,
    when: Date = new Date(),
  ): void {
    const normalized = normalizeStatus(status);

    if (normalized === this.props.status) {
      return;
    }

    this.props.status = normalized;
    this.props.statusChangedAt = when;
    this.props.statusChangedBy = actorId;

    if (normalized === 'realizado') {
      this.props.realizadoAt = when;
      this.props.realizadoBy = actorId;
    } else {
      this.props.realizadoAt = null;
      this.props.realizadoBy = null;
    }
  }

  /** Moves the item to the trash; a reason is mandatory. */
  softDelete(
    actorId: string | null,
    reason: string,
    when: Date = new Date(),
  ): void {
    if (this.isDeleted) {
      throw new TreatmentPlanItemAlreadyDeletedError(this.id);
    }

    const normalizedReason = requireText(
      reason,
      'deletedReason',
      MAX_DELETE_REASON_LENGTH,
    );

    this.props.deletedAt = when;
    this.props.deletedBy = actorId;
    this.props.deletedReason = normalizedReason;
    this.props.updatedBy = actorId;
    this.props.updatedAt = when;
  }

  /** Brings the item back from the trash, clearing the deletion metadata. */
  restore(actorId: string | null, when: Date = new Date()): void {
    if (!this.isDeleted) {
      throw new TreatmentPlanItemNotDeletedError(this.id);
    }

    this.props.deletedAt = null;
    this.props.deletedBy = null;
    this.props.deletedReason = null;
    this.props.updatedBy = actorId;
    this.props.updatedAt = when;
  }

  touch(actorId: string | null, when: Date = new Date()): void {
    this.props.updatedBy = actorId;
    this.props.updatedAt = when;
  }
}

/** Aggregate root: one treatment plan per clinical record. */
export class TreatmentPlan extends Entity<{
  recordId: string;
  notes: string | null;
  notesUpdatedAt: Date | null;
  notesUpdatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  private constructor(
    props: {
      recordId: string;
      notes: string | null;
      notesUpdatedAt: Date | null;
      notesUpdatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    id?: string,
  ) {
    super(props, id);
  }

  static create(recordId: string): TreatmentPlan {
    const now = new Date();

    return new TreatmentPlan({
      recordId: requireText(recordId, 'recordId', 100),
      notes: null,
      notesUpdatedAt: null,
      notesUpdatedBy: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(
    props: {
      recordId: string;
      notes: string | null;
      notesUpdatedAt: Date | null;
      notesUpdatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    id: string,
  ): TreatmentPlan {
    return new TreatmentPlan(props, id);
  }

  get recordId(): string {
    return this.props.recordId;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get notesUpdatedAt(): Date | null {
    return this.props.notesUpdatedAt;
  }

  get notesUpdatedBy(): string | null {
    return this.props.notesUpdatedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Replaces the plan-level rich-text note (sanitized) and records who/when. */
  changeNotes(
    notes: string | null | undefined,
    actorId: string | null,
    when: Date = new Date(),
  ): void {
    this.props.notes = normalizeRichText(notes);
    this.props.notesUpdatedAt = when;
    this.props.notesUpdatedBy = actorId;
    this.props.updatedAt = when;
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

/**
 * Sanitizes the note and stores `null` when it carries no visible content, so
 * "empty" has a single representation. Throws when it exceeds the limit.
 */
function normalizeRichText(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  const clean = sanitizeRichText(value);

  if (isEmptyRichText(clean)) {
    return null;
  }

  if (clean.length > MAX_NOTES_LENGTH) {
    throw new InvalidTreatmentPlanError(
      `"notes" must have at most ${MAX_NOTES_LENGTH} characters`,
    );
  }

  return clean;
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
