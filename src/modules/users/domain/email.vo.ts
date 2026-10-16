import { ValueObject } from '../../../shared/domain/value-object.js';
import { InvalidEmailError } from './user.errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/**
 * Email value object. An `Email` instance is *always* valid and normalized
 * (trimmed, lower-cased) — the invariant lives here, once.
 */
export class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError(raw);
    }

    return new Email(normalized);
  }

  get value(): string {
    return this.props;
  }

  toString(): string {
    return this.value;
  }
}
