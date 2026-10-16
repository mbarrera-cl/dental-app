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

export class EmptyUserUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('At least one of "name" or "email" must be provided');
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

/** One of the requested role ids does not exist in the catalog. */
export class UnknownRoleError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(unknown: readonly string[]) {
    super(`Unknown role id(s): ${unknown.join(', ')}`, { details: { unknown } });
  }
}

const LAST_ADMIN_ACTION = {
  delete: 'deleted',
  disable: 'disabled',
  demote: 'stripped of the admin role',
} as const;

/**
 * A destructive change (delete, disable or demote) would leave the system
 * without any active administrator that can log in.
 */
export class LastAdminError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(action: keyof typeof LAST_ADMIN_ACTION) {
    super(`The last active administrator cannot be ${LAST_ADMIN_ACTION[action]}`, {
      details: { action },
    });
  }
}

/** Admin password reset without a candidate: neither typed nor generated. */
export class EmptyPasswordResetError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('Either "password" or "generate": true must be provided');
  }
}
