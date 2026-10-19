import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class InvalidTreatmentPlanError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid treatment plan: ${reason}`);
  }
}

export class TreatmentPlanNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Treatment plan with id "${id}" was not found`);
  }
}

export class TreatmentPlanItemNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Treatment plan item with id "${id}" was not found`);
  }
}

export class EmptyTreatmentPlanItemUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('At least one treatment plan item field must be provided');
  }
}

export class TreatmentPlanItemAlreadyDeletedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Treatment plan item with id "${id}" is already in the trash`);
  }
}

export class TreatmentPlanItemNotDeletedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Treatment plan item with id "${id}" is not in the trash`);
  }
}

export class QuoteNotImportableError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(reason: string) {
    super(`Quotation cannot be imported into the treatment plan: ${reason}`);
  }
}
