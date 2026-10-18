import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class InvalidConsentError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid consent: ${reason}`);
  }
}

export class ConsentTemplateNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(keyOrId: string) {
    super(`Consent template "${keyOrId}" was not found`);
  }
}

export class ConsentRecordNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Consent record with id "${id}" was not found`);
  }
}

export class ConsentTemplateAlreadyExistsError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(key: string) {
    super(`A consent template with key "${key}" already exists`);
  }
}
