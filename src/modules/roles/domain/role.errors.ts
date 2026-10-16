import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';
import { ADMIN_ROLE_NAME, ROLE_NAME_PATTERN } from './role.entity.js';

export class InvalidRoleNameError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(name: string) {
    super(
      `"${name}" is not a valid role name (2-40 chars, starting with a letter or digit; letters, digits, spaces, "-" and "_" allowed)`,
      { details: { pattern: ROLE_NAME_PATTERN.source } },
    );
  }
}

export class InvalidRoleDescriptionError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('Role descriptions must be at most 200 characters long');
  }
}

export class RoleNameReservedError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super(`"${ADMIN_ROLE_NAME}" is reserved for the built-in administrator role`);
  }
}

export class RoleNameTakenError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(name: string) {
    super(`A role named "${name}" already exists`);
  }
}

export class RoleNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Role with id "${id}" was not found`);
  }
}

/** The built-in role has protections that the panel cannot override. */
export class RoleProtectedError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`The built-in "${ADMIN_ROLE_NAME}" role is protected: ${reason}`);
  }
}

export class RoleAssignedError extends DomainError {
  readonly kind: DomainErrorKind = 'conflict';

  constructor(name: string, userCount: number) {
    super(`Role "${name}" is still assigned to ${userCount} user(s)`, { details: { userCount } });
  }
}

export class EmptyRoleUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('At least one of "name", "description" or "permissions" must be provided');
  }
}
