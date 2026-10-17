import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class QuoteFolioTakenError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(folio: string) {
    super(`A quote with folio "${folio}" already exists`);
  }
}
