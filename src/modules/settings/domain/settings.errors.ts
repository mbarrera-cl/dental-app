import { DomainError, type DomainErrorKind } from '../../../shared/domain/domain-error.js';

export interface SettingProblem {
  readonly key: string;
  readonly reason: string;
}

export class SettingsUnknownKeyError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(keys: readonly string[]) {
    super(`Unknown setting(s): ${keys.join(', ')}`, { details: { keys } });
  }
}

export class SettingsValueInvalidError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor(problems: readonly SettingProblem[]) {
    super(
      `Invalid setting value(s): ${problems.map(({ key, reason }) => `${key} (${reason})`).join('; ')}`,
      { details: { problems } },
    );
  }
}

export class EmptySettingsUpdateError extends DomainError {
  readonly kind: DomainErrorKind = 'validation';

  constructor() {
    super('At least one setting must be provided');
  }
}
