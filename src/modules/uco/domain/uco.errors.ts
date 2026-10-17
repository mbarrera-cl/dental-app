import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class InvalidUcoProcedureError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid UCO procedure: ${reason}`);
  }
}

export class UcoProcedureNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`UCO procedure with id "${id}" was not found`);
  }
}

export class UcoProcedureCodeTakenError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(code: string) {
    super(`A UCO procedure with code "${code}" already exists`);
  }
}
