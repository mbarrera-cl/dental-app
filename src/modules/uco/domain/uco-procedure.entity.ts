import { Entity } from '../../../shared/domain/entity.js';

/** Soft-delete status of a fee catalog entry. */
export type UcoStatus = 'active' | 'inactive';

export interface UcoProcedureProps {
  code: string;
  chapter: string;
  name: string;
  /** Decimal UCO units, e.g. `1.5`. */
  units: number;
  status: UcoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUcoProcedureProps {
  code: string;
  chapter: string;
  name: string;
  units: number;
}

/**
 * A priced procedure in the UCO fee catalog. The code is the business key
 * (unique); the entity enforces the shape of every field so a malformed row
 * can never reach the database.
 */
export class UcoProcedure extends Entity<UcoProcedureProps> {
  private constructor(props: UcoProcedureProps, id?: string) {
    super(props, id);
  }

  static create(props: CreateUcoProcedureProps): UcoProcedure {
    const now = new Date();

    return new UcoProcedure({
      code: normalizeCode(props.code),
      chapter: normalizeText(props.chapter, 'chapter', 16),
      name: normalizeText(props.name, 'name', 200),
      units: normalizeUnits(props.units),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rebuilds an entry that already exists (e.g. loaded from a database). */
  static reconstitute(props: UcoProcedureProps, id: string): UcoProcedure {
    return new UcoProcedure(props, id);
  }

  get code(): string {
    return this.props.code;
  }

  get chapter(): string {
    return this.props.chapter;
  }

  get name(): string {
    return this.props.name;
  }

  get units(): number {
    return this.props.units;
  }

  get status(): UcoStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changeCode(code: string): void {
    this.props.code = normalizeCode(code);
    this.touch();
  }

  changeChapter(chapter: string): void {
    this.props.chapter = normalizeText(chapter, 'chapter', 16);
    this.touch();
  }

  changeName(name: string): void {
    this.props.name = normalizeText(name, 'name', 200);
    this.touch();
  }

  changeUnits(units: number): void {
    this.props.units = normalizeUnits(units);
    this.touch();
  }

  /** Soft-delete: hides it from the searchable catalog, keeps history valid. */
  deactivate(): void {
    if (this.props.status !== 'inactive') {
      this.props.status = 'inactive';
      this.touch();
    }
  }

  reactivate(): void {
    if (this.props.status !== 'active') {
      this.props.status = 'active';
      this.touch();
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

function normalizeCode(code: string): string {
  const normalized = code.trim().toUpperCase();

  if (normalized.length === 0) {
    throw new Error('uco.invalidCode');
  }

  if (normalized.length > 16) {
    throw new Error('uco.invalidCode');
  }

  return normalized;
}

function normalizeText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`uco.${field}.required`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`uco.${field}.tooLong`);
  }

  return normalized;
}

function normalizeUnits(units: number): number {
  if (typeof units !== 'number' || !Number.isFinite(units) || units <= 0 || units > 100_000) {
    throw new Error('uco.invalidUnits');
  }

  return Math.round(units * 1000) / 1000;
}
