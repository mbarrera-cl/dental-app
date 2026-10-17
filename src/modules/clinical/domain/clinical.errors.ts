import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

export class InvalidCategoriaEtariaError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(value: string) {
    super(`"${value}" is not a supported categoria etaria of the HCU form`);
  }
}

export class InvalidFichaClinicaError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid ficha clinica: ${reason}`);
  }
}

export class InvalidAntecedentesError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid antecedentes: ${reason}`);
  }
}

export class InvalidSignosVitalesError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid signos vitales: ${reason}`);
  }
}

export class InvalidExamenEstomatognaticoError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid examen del sistema estomatognatico: ${reason}`);
  }
}

export class InvalidHigieneOralError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid higiene oral simplificada: ${reason}`);
  }
}

export class InvalidIndicadoresError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid indicadores de salud bucal: ${reason}`);
  }
}

export class InvalidFindingError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid odontogram finding: ${reason}`);
  }
}

export class ClinicalRecordNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Clinical record with id "${id}" was not found`);
  }
}

export class PatientClinicalRecordNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(patientId: string) {
    super(`Patient with id "${patientId}" has no clinical record yet`);
  }
}

export class ClinicalRecordAlreadyExistsError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(patientId: string) {
    super(`Patient with id "${patientId}" already has a clinical record`);
  }
}

export class ClinicalFindingNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Odontogram finding with id "${id}" was not found`);
  }
}

export class ClinicalFindingAlreadyVoidedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Odontogram finding with id "${id}" is already voided`);
  }
}

export class EmptyClinicalRecordUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('At least one clinical record field must be provided');
  }
}

export class ClinicalRecordLockedError extends DomainError {
  readonly kind: DomainErrorKind = 'locked';

  constructor(id: string) {
    super(`Clinical record with id "${id}" is finalized and cannot be edited`);
  }
}
