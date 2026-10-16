import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';

/**
 * Raised by the global authentication guard for missing, malformed,
 * expired or revoked credentials. Deliberately generic: it never reveals
 * whether a token/user exists.
 */
export class AuthenticationRequiredError extends DomainError {
  readonly kind: DomainErrorKind = 'unauthorized';

  constructor(message = 'Authentication required') {
    super(message);
  }
}
