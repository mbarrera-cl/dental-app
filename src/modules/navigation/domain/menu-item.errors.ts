import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';

export class InvalidMenuItemKindError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(kind: string) {
    super(`"${kind}" is not a valid menu kind (expected "item", "group" or "divider")`);
  }
}

/**
 * `item` requires exactly one destination (route key *or* external URL);
 * `group` and `divider` accept none.
 */
export class InvalidMenuDestinationError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(kind: 'item' | 'group' | 'divider') {
    super(
      kind === 'item'
        ? 'A menu item must point to exactly one destination: a route key or an external https URL'
        : `A menu ${kind} cannot have a destination`,
    );
  }
}

export class InvalidMenuRouteKeyError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(routeKey: string) {
    super(
      `"${routeKey}" is not a valid route key (dotted lowercase identifier, e.g. "settings.menu", at most 80 characters)`,
    );
  }
}

export class InvalidMenuExternalUrlError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(url: string) {
    super(`"${url}" is not a valid external URL (absolute https:// URL without credentials)`);
  }
}

export class InvalidMenuLabelError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(reason: string) {
    super(`Invalid menu label: ${reason}`);
  }
}

export class InvalidMenuIconError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(icon: string) {
    super(`Menu icons are capped at 40 characters ("${icon}" is too long)`);
  }
}

export class InvalidMenuPositionError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(position: number) {
    super(`Menu positions must be integers greater than or equal to 0 (got ${position})`);
  }
}

/** Groups are always top-level: exactly two levels (group → children). */
export class NestedMenuGroupError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('Menu groups are top-level only: a group cannot have a parent');
  }
}

export class MenuItemNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = 'not_found';

  constructor(id: string) {
    super(`Menu item with id "${id}" was not found`);
  }
}

export class MenuParentNotGroupError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(parentId: string) {
    super(`Menu parent "${parentId}" does not exist or is not a group`);
  }
}

export class MenuReorderDuplicateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(id: string) {
    super(`The reorder payload repeats the menu item "${id}"`);
  }
}

export class MenuReorderSelfParentError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(id: string) {
    super(`Menu item "${id}" cannot be its own parent`);
  }
}

export class EmptyMenuItemUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super(
      'At least one of "label", "icon", "routeKey", "externalUrl", "requiredPermission" or "enabled" must be provided',
    );
  }
}
