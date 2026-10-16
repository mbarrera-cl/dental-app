import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';

export class InvalidEmailError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(email: string) {
    super(`"${email}" is not a valid email address`);
  }
}

export class InvalidNameError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('Name must contain at least one non-whitespace character');
  }
}

export class UserNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`User with id "${id}" was not found`);
  }
}

export class UserAlreadyExistsError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(email: string) {
    super(`A user with email "${email}" already exists`);
  }
}
