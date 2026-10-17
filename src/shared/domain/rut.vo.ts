import { InvalidRutError } from './persona.errors.js';
import { ValueObject } from './value-object.js';

/** Longest real RUT body in use (the check digit comes on top). */
const MAX_BODY_LENGTH = 9;

/** Visual separators tolerated on input: "12.345.678-5" → "123456785". */
const SEPARATOR_PATTERN = /[.\-\s]/g;

/**
 * RUT value object (Chilean national identifier, e.g. `12345678-5`).
 *
 * An instance is *always* in the canonical form — body without dots or
 * leading zeros, uppercase check digit — and its check digit has been
 * verified with the módulo 11 algorithm the Registro Civil uses. Shared by
 * every context that stores one (patients today, the clinic identity next).
 */
export class Rut extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  /**
   * Accepts the common spellings (dots, spaces, missing hyphen, lowercase
   * `k`) and returns the canonical `12345678-5` form, or throws
   * `InvalidRutError` when the check digit does not match.
   */
  static create(raw: string): Rut {
    const compact = raw.replace(SEPARATOR_PATTERN, '').toUpperCase();
    const body = compact.slice(0, -1).replace(/^0+/, '');
    const checkDigit = compact.slice(-1);

    if (
      compact.length < 2 ||
      body.length > MAX_BODY_LENGTH ||
      !/^\d+$/.test(body) ||
      !/^[0-9K]$/.test(checkDigit)
    ) {
      throw new InvalidRutError(raw);
    }

    if (Rut.computeCheckDigit(body) !== checkDigit) {
      throw new InvalidRutError(raw);
    }

    return new Rut(`${body}-${checkDigit}`);
  }

  /** Módulo 11: weights 2..7 cycling from the rightmost digit. */
  static computeCheckDigit(body: string): string {
    let sum = 0;
    let multiplier = 2;

    for (let index = body.length - 1; index >= 0; index -= 1) {
      sum += Number(body[index]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);

    if (remainder === 11) return '0';
    if (remainder === 10) return 'K';
    return String(remainder);
  }

  get value(): string {
    return this.props;
  }

  toString(): string {
    return this.value;
  }
}
