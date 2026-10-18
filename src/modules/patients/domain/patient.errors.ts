import {
  DomainError,
  type DomainErrorKind,
} from '../../../shared/domain/domain-error.js';

/** Local copy on purpose: the patients context stays decoupled from users. */
export class InvalidEmailError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(email: string) {
    super(`"${email}" is not a valid email address`);
  }
}

export class InvalidPatientNameError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(field: string) {
    super(
      `Patient field "${field}" must contain at least one non-whitespace character`,
    );
  }
}

export class InvalidFechaNacimientoError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(value: string, reason: string) {
    super(`"${value}" is not a valid birth date: ${reason}`);
  }
}

export class InvalidSexoError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(value: string) {
    super(`"${value}" is not a supported sexo (femenino, masculino or otro)`);
  }
}

export class InvalidNumeroHistoriaError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(value: string) {
    super(
      `"${value}" is not a valid numero de historia clinica (expected the HC-000123 shape)`,
    );
  }
}

export class InvalidRegionError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(code: string) {
    super(`"${code}" is not a valid Chilean region code`);
  }
}

export class InvalidDireccionError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(field: string) {
    super(
      `Direccion field "${field}" must contain at least one non-whitespace character`,
    );
  }
}

export class InvalidPrevisionError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid prevision de salud: ${reason}`);
  }
}

export class InvalidContactoEmergenciaError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(field: string) {
    super(
      `Contacto de emergencia field "${field}" must contain at least one non-whitespace character`,
    );
  }
}

export class EmptyPatientUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('At least one patient field must be provided');
  }
}

export class PatientNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Patient with id "${id}" was not found`);
  }
}

export class PatientRutNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(rut: string) {
    super(`Patient with RUT "${rut}" was not found`);
  }
}

export class PatientAlreadyExistsError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(rut: string) {
    super(`A patient with RUT "${rut}" already exists`);
  }
}

/**
 * A patient with linked records cannot be deleted: quotations and account
 * (ledger) entries reference it (`ON DELETE RESTRICT`) and priced or paid
 * history must not vanish silently.
 */
export class PatientHasLinkedRecordsError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(id: string) {
    super(`Patient with id "${id}" has linked records (quotations or account entries) and cannot be deleted`);
  }
}
