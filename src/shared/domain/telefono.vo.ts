import { InvalidTelefonoError } from './persona.errors.js';
import { ValueObject } from './value-object.js';

/** Visual separators tolerated on input. */
const SEPARATOR_PATTERN = /[\s.\-()]/g;

/** National numbers: 8 digits (some fixed lines) or 9 (mobile / area + number). */
const NATIONAL_PATTERN = /^\d{8,9}$/;

const MAX_INPUT_LENGTH = 30;

/**
 * Chilean phone number value object. On input it tolerates the usual
 * spellings (`+56 9 1234 5678`, `912345678`, `+56912345678`); the stored
 * value is always the canonical `+56912345678` form. Shared by every context
 * that stores one (patients today, the clinic identity next).
 */
export class Telefono extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): Telefono {
    const compact = raw.replace(SEPARATOR_PATTERN, '');

    if (compact.length === 0 || compact.length > MAX_INPUT_LENGTH) {
      throw new InvalidTelefonoError(raw);
    }

    let national: string;

    if (compact.startsWith('+')) {
      if (!compact.startsWith('+56')) {
        throw new InvalidTelefonoError(raw);
      }

      national = compact.slice(3);
    } else if (compact.length === 11 && compact.startsWith('56')) {
      // Country code typed without the plus ("56912345678").
      national = compact.slice(2);
    } else {
      national = compact;
    }

    if (!NATIONAL_PATTERN.test(national)) {
      throw new InvalidTelefonoError(raw);
    }

    return new Telefono(`+56${national}`);
  }

  get value(): string {
    return this.props;
  }

  toString(): string {
    return this.value;
  }
}
