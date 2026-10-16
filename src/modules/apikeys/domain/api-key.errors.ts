import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';

export class ApiKeyNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`API key "${id}" does not exist`);
  }
}

export class ApiKeyAlreadyRevokedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`API key "${id}" is already revoked`);
  }
}

export class InvalidApiKeyNameError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('The API key name must be between 1 and 60 characters long');
  }
}

export class InvalidApiKeyExpirationError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(days: number) {
    super(`Invalid expiration: ${days} day(s)`, { details: { days } });
  }
}

/** Scope keys must exist in the permission catalog. */
export class InvalidApiKeyScopesError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(unknown: readonly string[]) {
    super(`Unknown permission(s): ${unknown.join(', ')}`, { details: { unknown } });
  }
}

/** A key can only scope *down*: every scope must be held by its owner. */
export class ApiKeyScopesExceedPermissionsError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(exceeding: readonly string[]) {
    super(`The owner does not hold: ${exceeding.join(', ')}`, { details: { exceeding } });
  }
}

export class ApiKeyLimitReachedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(max: number) {
    super(`The user already has ${max} active API keys`, { details: { max } });
  }
}

/** The user a key would belong to does not exist (admin-created keys). */
export class ApiKeyOwnerNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(userId: string) {
    super(`User "${userId}" does not exist`);
  }
}
