import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';

export class PermissionUnknownError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(unknown: readonly string[]) {
    super(`Unknown permission(s): ${unknown.join(', ')}`, { details: { unknown } });
  }
}

/** The authenticated principal lacks one or more required permissions. */
export class PermissionDeniedError extends DomainError {
  readonly kind: DomainErrorKind = 'forbidden';

  constructor(missing: readonly string[]) {
    super('You do not have the required permission(s)', { details: { missing } });
  }
}
