import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';

export class CaroConversationNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Conversation not found');
  }
}

export class CaroApprovalNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor() {
    super('Approval not found');
  }
}

export class CaroApprovalNotPendingError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('This approval has already been decided');
  }
}

export class CaroApprovalExpiredError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('This approval has expired');
  }
}

export class CaroIaMessageTooLongError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(max: number) {
    super(`The message exceeds the ${max} character limit`);
  }
}

export class CaroIaEmptyMessageError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('The message cannot be empty');
  }
}

export class CaroIaRateLimitedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor() {
    super('Too many CaroIA messages. Wait a minute and try again.');
  }
}

export class CaroIaWritesDisabledError extends DomainError {
  readonly kind: DomainErrorKind = 'forbidden';

  constructor() {
    super('CaroIA writes are disabled by the administrator');
  }
}

export class CaroIaForbiddenError extends DomainError {
  readonly kind: DomainErrorKind = 'forbidden';

  constructor(message = 'You cannot perform this CaroIA action') {
    super(message);
  }
}

export class CaroIaNotConfiguredError extends DomainError {
  readonly kind: DomainErrorKind = 'unexpected';

  constructor(service: string) {
    super(`${service} is not configured`);
  }
}

export class CaroIaProviderError extends DomainError {
  readonly kind: DomainErrorKind = 'unexpected';

  constructor(message: string) {
    super(message);
  }
}

export class CaroIaUnsupportedAttachmentError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('Attachments are not supported yet');
  }
}

export class CaroIaAudioError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(message: string) {
    super(message);
  }
}
