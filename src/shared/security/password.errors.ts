import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';
import type { PasswordPolicyViolation } from './password-policy.js';

/** The candidate breaks the configurable password policy. */
export class PasswordPolicyViolationError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(violations: readonly PasswordPolicyViolation[]) {
    super('The password does not satisfy the password policy', {
      details: { violations },
    });
  }
}

/** The candidate was one of the last N passwords (history check). */
export class PasswordReusedError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(historyCount: number) {
    super(`The password was already used in the last ${historyCount} passwords`, {
      details: { historyCount },
    });
  }
}
