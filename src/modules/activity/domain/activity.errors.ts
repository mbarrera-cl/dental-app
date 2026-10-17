import { DomainError } from '../../../shared/domain/domain-error.js';

/** The purge request has no scope: neither `all` nor a cutoff date. */
export class ActivityPurgeScopeError extends DomainError {
  readonly kind = 'validation' as const;

  constructor() {
    super('The purge needs either `all: true` or an ISO `before` date.');
  }
}

/** The purge cutoff is not a valid ISO-8601 date. */
export class ActivityPurgeDateError extends DomainError {
  readonly kind = 'validation' as const;

  constructor(value: string) {
    super('`before` must be a valid ISO-8601 date.', { details: { before: value } });
  }
}
