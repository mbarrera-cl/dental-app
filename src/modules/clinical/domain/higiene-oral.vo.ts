import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidHigieneOralError } from './clinical.errors.js';

/** Index teeth of the simplified oral hygiene index (all quadrants). */
export const PIEZAS_HIGIENE_ORAL = [
  16, 17, 55, 11, 21, 51, 26, 27, 65,
  36, 37, 75, 31, 41, 71, 46, 47, 85,
] as const;

export type PiezaHigieneOral = (typeof PIEZAS_HIGIENE_ORAL)[number];

export interface HigieneOralEntry {
  /** Dental plaque 0–3. */
  placa: number | null;
  /** Calculus 0–3. */
  calculo: number | null;
  /** Gingivitis 0–1. */
  gingivitis: number | null;
}

export type HigieneOralRecord = Record<PiezaHigieneOral, HigieneOralEntry>;

export type HigieneOralInput = Record<
  string,
  { placa?: number | null; calculo?: number | null; gingivitis?: number | null }
>;

export interface HigieneOralTotales {
  placa: number;
  calculo: number;
  gingivitis: number;
  total: number;
}

/**
 * Simplified oral hygiene table: plaque (0–3), calculus (0–3) and gingivitis
 * (0–1) per index tooth. Totals are derived, never stored.
 */
export class HigieneOral extends ValueObject<{ entries: HigieneOralRecord }> {
  private constructor(entries: HigieneOralRecord) {
    super({ entries });
  }

  static create(input: HigieneOralInput | null | undefined): HigieneOral {
    const source = input ?? {};

    for (const key of Object.keys(source)) {
      if (!(PIEZAS_HIGIENE_ORAL as readonly number[]).includes(Number(key))) {
        throw new InvalidHigieneOralError(`unknown index tooth "${key}"`);
      }
    }

    const entries = {} as HigieneOralRecord;

    for (const pieza of PIEZAS_HIGIENE_ORAL) {
      const raw = source[String(pieza)] ?? {};
      entries[pieza] = {
        placa: optionalScore(raw.placa, 3, `placa of piece ${pieza}`),
        calculo: optionalScore(raw.calculo, 3, `calculo of piece ${pieza}`),
        gingivitis: optionalScore(raw.gingivitis, 1, `gingivitis of piece ${pieza}`),
      };
    }

    return new HigieneOral(entries);
  }

  get(pieza: PiezaHigieneOral): HigieneOralEntry {
    return this.props.entries[pieza];
  }

  get entries(): Readonly<HigieneOralRecord> {
    return this.props.entries;
  }

  /** Column sums of the recorded scores; unrecorded cells do not count. */
  get totales(): HigieneOralTotales {
    let placa = 0;
    let calculo = 0;
    let gingivitis = 0;

    for (const entry of Object.values(this.props.entries)) {
      placa += entry.placa ?? 0;
      calculo += entry.calculo ?? 0;
      gingivitis += entry.gingivitis ?? 0;
    }

    return { placa, calculo, gingivitis, total: placa + calculo + gingivitis };
  }

  toJSON(): HigieneOralRecord {
    return this.props.entries;
  }
}

function optionalScore(
  value: number | null | undefined,
  max: number,
  field: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new InvalidHigieneOralError(
      `${field} must be an integer between 0 and ${max}`,
    );
  }

  return value;
}
