/**
 * A *setting* is a typed, named value the administrator can edit from the
 * panel. Definitions live in code (the registry); values live in the
 * database. The admin panel renders its form from the definitions, so adding
 * a configurable knob is a one-line change.
 */
export type SettingType =
  | 'number'
  | 'boolean'
  | 'string'
  | 'color'
  | 'email'
  | 'url'
  | 'rut'
  | 'phone'
  | 'enum'
  | 'html';

export type SettingValue = number | boolean | string;

export type SettingGroupId =
  | 'passwordPolicy'
  | 'login'
  | 'session'
  | 'apiKeys'
  | 'clinic'
  | 'quotes'
  | 'activity'
  | 'mcp'
  | 'caroIa'
  | 'agenda';

/** Who may change the setting: everyone with `settings:update`, or only `settings:update-security`. */
export type SettingSensitivity = 'security' | 'standard';

export interface SettingGroup {
  readonly id: SettingGroupId;
  /** Developer-facing description (UI wording lives in the i18n dictionaries). */
  readonly description: string;
}

export interface SettingDefinition {
  /** Stable key: `group.name`, e.g. `passwordPolicy.minLength`. */
  readonly key: string;
  readonly group: SettingGroupId;
  readonly type: SettingType;
  readonly default: SettingValue;
  /**
   * `security` settings (password policy, lockout, tokens, write gates)
   * additionally require the `settings:update-security` permission.
   * Defaults to `standard`.
   */
  readonly sensitivity?: SettingSensitivity;
  /** Inclusive bounds for `number` settings. */
  readonly min?: number;
  readonly max?: number;
  /** Longest accepted value for text-like settings (`string`). */
  readonly maxLength?: number;
  /** Allowed values for `enum` settings. */
  readonly values?: readonly string[];
  /**
   * Managed settings are written by their own module (never by
   * `PATCH /settings`), e.g. `clinic.logo.version` from the clinic module.
   */
  readonly managed?: boolean;
  /** Developer-facing description (UI wording lives in the i18n dictionaries). */
  readonly description: string;
}

/** A definition merged with its effective value. */
export interface SettingOverview extends SettingDefinition {
  readonly value: SettingValue;
}
