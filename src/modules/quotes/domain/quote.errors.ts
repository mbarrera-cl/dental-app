import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class QuoteNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Quote with id "${id}" was not found`);
  }
}

export class QuoteLockedError extends DomainError {
  readonly kind: DomainErrorKind = 'locked';

  constructor(id: string) {
    super(`Quote with id "${id}" is sanctioned and cannot be edited`);
  }
}

export class QuoteAlreadySanctionedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Quote with id "${id}" is already sanctioned`);
  }
}

export class QuoteOnlyDraftTransitionError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Quote with id "${id}" can only be delivered from the draft state`);
  }
}

export class InvalidQuoteError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid quote: ${reason}`);
  }
}

export class QuoteItemNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(quoteId: string, itemId: string) {
    super(`Quote "${quoteId}" has no item with id "${itemId}"`);
  }
}

export class QuoteItemInvalidDecisionError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid quote item decision: ${reason}`);
  }
}
