import { Entity } from '../../../shared/domain/entity.js';
import {
  ClinicalFindingAlreadyVoidedError,
  InvalidFindingError,
} from './clinical.errors.js';

/**
 * Odontogram symbols of the HCU form. Red states are current problems,
 * blue states are performed treatments (see `defaultStateFor`).
 */
export const FINDING_SYMBOLS = [
  'sellante-necesario',
  'sellante-realizado',
  'extraccion-indicada',
  'perdida-caries',
  'perdida-otra',
  'endodoncia',
  'protesis-fija',
  'protesis-removible',
  'protesis-total',
  'corona',
  'obturado',
  'caries',
] as const;

export type FindingSymbol = (typeof FINDING_SYMBOLS)[number];

export const FINDING_STATES = ['a-realizar', 'realizado'] as const;
export type FindingState = (typeof FINDING_STATES)[number];

/** `V`estibular, `L`ingual/palatina, `M`esial, `D`istal, `O`clusal, `R`aíz. */
export const SURFACES = ['V', 'L', 'M', 'D', 'O', 'R'] as const;
export type Surface = (typeof SURFACES)[number];

/** Symbols still pending: everything else is drawn in blue (done). */
const PENDING_SYMBOLS: readonly FindingSymbol[] = [
  'sellante-necesario',
  'extraccion-indicada',
  'caries',
];

export function defaultStateFor(symbol: FindingSymbol): FindingState {
  return PENDING_SYMBOLS.includes(symbol) ? 'a-realizar' : 'realizado';
}

/** FDI permanent teeth: quadrants 1–4, positions 1–8. */
export function isPermanentTooth(tooth: number): boolean {
  const quadrant = Math.floor(tooth / 10);
  const position = tooth % 10;

  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8;
}

/** FDI primary (deciduous) teeth: quadrants 5–8, positions 1–5. */
export function isPrimaryTooth(tooth: number): boolean {
  const quadrant = Math.floor(tooth / 10);
  const position = tooth % 10;

  return quadrant >= 5 && quadrant <= 8 && position >= 1 && position <= 5;
}

export function isFdiTooth(tooth: number): boolean {
  return Number.isInteger(tooth) && (isPermanentTooth(tooth) || isPrimaryTooth(tooth));
}

export interface FindingProps {
  recordId: string;
  tooth: number;
  surfaces: readonly Surface[];
  symbol: FindingSymbol;
  state: FindingState;
  recesion: number | null;
  movilidad: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
  voidedAt: Date | null;
  voidedBy: string | null;
}

export interface CreateFindingProps {
  recordId: string;
  tooth: number;
  surfaces?: readonly string[];
  symbol: string;
  recesion?: number | null;
  movilidad?: number | null;
  note?: string | null;
  createdBy: string | null;
}

const MAX_NOTE_LENGTH = 500;
const RECESION_MOVILIDAD_VALUES = [1, 2, 3];

/**
 * One odontogram action. Findings are an append-only log: chart state is the
 * projection of the non-voided findings (`clinical-indices.ts` / frontend),
 * and a mistake is undone by voiding the finding — never by deleting history.
 */
export class Finding extends Entity<FindingProps> {
  private constructor(props: FindingProps, id?: string) {
    super(props, id);
  }

  static create({
    recordId,
    tooth,
    surfaces,
    symbol,
    recesion,
    movilidad,
    note,
    createdBy,
  }: CreateFindingProps): Finding {
    const normalizedSymbol = normalizeSymbol(symbol);

    return new Finding({
      recordId: requireText(recordId, 'recordId'),
      tooth: normalizeTooth(tooth),
      surfaces: normalizeSurfaces(surfaces ?? []),
      symbol: normalizedSymbol,
      state: defaultStateFor(normalizedSymbol),
      recesion: normalizeGrade(recesion, 'recesion'),
      movilidad: normalizeGrade(movilidad, 'movilidad'),
      note: normalizeNote(note),
      createdBy,
      createdAt: new Date(),
      voidedAt: null,
      voidedBy: null,
    });
  }

  static reconstitute(props: FindingProps, id: string): Finding {
    return new Finding(props, id);
  }

  get recordId(): string {
    return this.props.recordId;
  }

  get tooth(): number {
    return this.props.tooth;
  }

  get surfaces(): readonly Surface[] {
    return this.props.surfaces;
  }

  get symbol(): FindingSymbol {
    return this.props.symbol;
  }

  get state(): FindingState {
    return this.props.state;
  }

  get recesion(): number | null {
    return this.props.recesion;
  }

  get movilidad(): number | null {
    return this.props.movilidad;
  }

  get note(): string | null {
    return this.props.note;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get voidedAt(): Date | null {
    return this.props.voidedAt;
  }

  get voidedBy(): string | null {
    return this.props.voidedBy;
  }

  get isVoided(): boolean {
    return this.props.voidedAt !== null;
  }

  /** Undo of a mistaken action; voiding twice is rejected. */
  void(actorId: string | null, when: Date = new Date()): void {
    if (this.props.voidedAt !== null) {
      throw new ClinicalFindingAlreadyVoidedError(this.id);
    }

    this.props.voidedAt = when;
    this.props.voidedBy = actorId;
  }
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidFindingError(`"${field}" must not be empty`);
  }

  return trimmed;
}

function normalizeTooth(tooth: number): number {
  if (!isFdiTooth(tooth)) {
    throw new InvalidFindingError(
      `"${tooth}" is not an FDI tooth (permanent 11–48, primary 51–85)`,
    );
  }

  return tooth;
}

function normalizeSymbol(symbol: string): FindingSymbol {
  if (!(FINDING_SYMBOLS as readonly string[]).includes(symbol)) {
    throw new InvalidFindingError(`unknown symbol "${symbol}"`);
  }

  return symbol as FindingSymbol;
}

function normalizeSurfaces(surfaces: readonly string[]): readonly Surface[] {
  const normalized: Surface[] = [];

  for (const surface of surfaces) {
    const upper = surface.trim().toUpperCase();

    if (!(SURFACES as readonly string[]).includes(upper)) {
      throw new InvalidFindingError(`unknown surface "${surface}"`);
    }

    if (!normalized.includes(upper as Surface)) {
      normalized.push(upper as Surface);
    }
  }

  return normalized;
}

function normalizeGrade(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || !RECESION_MOVILIDAD_VALUES.includes(value)) {
    throw new InvalidFindingError(`"${field}" must be 1, 2 or 3`);
  }

  return value;
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note === null || note === undefined) {
    return null;
  }

  if (typeof note !== 'string') {
    throw new InvalidFindingError('note must be a string');
  }

  const trimmed = note.trim();

  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new InvalidFindingError(
      `note must have at most ${MAX_NOTE_LENGTH} characters`,
    );
  }

  return trimmed.length === 0 ? null : trimmed;
}
