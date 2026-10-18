import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class InvalidMovementError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid ledger movement: ${reason}`);
  }
}

export class MovementNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Ledger movement with id "${id}" was not found`);
  }
}

export class MovementAlreadyVoidedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Ledger movement with id "${id}" is already voided`);
  }
}
