import { DomainError, type DomainErrorKind } from './domain-error.js';

/**
 * Validation errors of the shared Chilean value objects (`Rut`, `Telefono`).
 * Any context that stores one of those values throws these, so the transport
 * and the domain never disagree on what is valid.
 */

export class InvalidRutError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(rut: string) {
    super(`"${rut}" is not a valid Chilean RUT (expected e.g. "12345678-5")`);
  }
}

export class InvalidTelefonoError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(phone: string) {
    super(
      `"${phone}" is not a valid Chilean phone number (expected e.g. "+56912345678")`,
    );
  }
}
