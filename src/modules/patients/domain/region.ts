import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidRegionError } from './patient.errors.js';

/**
 * The 16 Chilean regions in north-to-south order (official codes). The
 * display names live in the frontend catalog; the backend only enforces
 * the code.
 */
export const REGION_CODES = [
  'XV',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'RM',
  'VI',
  'VII',
  'XVI',
  'VIII',
  'IX',
  'XIV',
  'X',
  'XI',
  'XII',
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

export function isRegionCode(value: string): value is RegionCode {
  return (REGION_CODES as readonly string[]).includes(value);
}

/** Region value object: always one of the 16 official codes. */
export class Region extends ValueObject<RegionCode> {
  private constructor(value: RegionCode) {
    super(value);
  }

  static create(raw: string): Region {
    const code = raw.trim().toUpperCase();

    if (!isRegionCode(code)) {
      throw new InvalidRegionError(raw);
    }

    return new Region(code);
  }

  get value(): RegionCode {
    return this.props;
  }

  toString(): string {
    return this.value;
  }
}
