import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidFechaNacimientoError } from './patient.errors.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_YEAR = 1900;

/**
 * Birth date value object. Stored as a timezone-free `YYYY-MM-DD` string so
 * it never shifts a day depending on the server's zone.
 */
export class FechaNacimiento extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): FechaNacimiento {
    const value = raw.trim();

    if (!DATE_PATTERN.test(value)) {
      throw new InvalidFechaNacimientoError(raw, 'expected format YYYY-MM-DD');
    }

    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;

    if (!isRealDate) {
      throw new InvalidFechaNacimientoError(
        raw,
        'it is not a real calendar date',
      );
    }

    if (year < MIN_YEAR) {
      throw new InvalidFechaNacimientoError(
        raw,
        `it must not be earlier than ${MIN_YEAR}-01-01`,
      );
    }

    if (value > new Date().toISOString().slice(0, 10)) {
      throw new InvalidFechaNacimientoError(
        raw,
        'it must not be in the future',
      );
    }

    return new FechaNacimiento(value);
  }

  get value(): string {
    return this.props;
  }

  toString(): string {
    return this.value;
  }
}
