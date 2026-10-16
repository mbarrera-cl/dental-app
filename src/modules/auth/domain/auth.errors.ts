import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';

/**
 * Same error for "unknown user", "no password set" and "wrong password" so
 * the endpoint never reveals which accounts exist.
 */
export class InvalidCredentialsError extends DomainError {
  readonly kind: DomainErrorKind = 'unauthorized';

  constructor() {
    super('Invalid email or password');
  }
}

export class AccountDisabledError extends DomainError {
  readonly kind: DomainErrorKind = 'forbidden';

  constructor() {
    super('This account is disabled');
  }
}

export class AccountLockedError extends DomainError {
  readonly kind: DomainErrorKind = 'locked';

  constructor(lockedUntil: Date) {
    super('The account is temporarily locked due to failed login attempts', {
      details: { lockedUntil: lockedUntil.toISOString() },
    });
  }
}

/** The credentials are valid but the password must be changed first. */
export class PasswordChangeRequiredError extends DomainError {
  readonly kind: DomainErrorKind = 'forbidden';

  constructor(reason: 'expired' | 'reset') {
    super('The password must be changed before signing in', { details: { reason } });
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly kind: DomainErrorKind = 'unauthorized';

  constructor() {
    super('The session is invalid or has expired');
  }
}
