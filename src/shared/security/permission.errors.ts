import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';

export class PermissionUnknownError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(unknown: readonly string[]) {
    super(`Unknown permission(s): ${unknown.join(', ')}`, { details: { unknown } });
  }
}
