import { DomainError } from '../../../shared/domain/domain-error.js';

export class InvalidAppointmentRangeError extends DomainError {
  readonly kind = 'validation' as const;

  constructor(reason: string) {
    super(`Invalid appointment range: ${reason}`);
  }
}

export class AppointmentNotFoundError extends DomainError {
  readonly kind = 'not_found' as const;

  constructor(id: string) {
    super(`Appointment with id "${id}" was not found`);
  }
}

export class AgendaPatientNotFoundError extends DomainError {
  readonly kind = 'not_found' as const;

  constructor(id: string) {
    super(`Patient with id "${id}" was not found`);
  }
}

export class AgendaProfessionalNotFoundError extends DomainError {
  readonly kind = 'validation' as const;

  constructor(id: string) {
    super(`User "${id}" is not an active agenda professional`);
  }
}
