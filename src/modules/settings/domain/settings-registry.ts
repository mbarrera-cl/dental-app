import type { SettingDefinition, SettingGroup, SettingValue } from './setting-definition.js';

/** UI groups of the settings form, in presentation order. */
export const SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'passwordPolicy', description: 'Password complexity, history and expiry' },
  { id: 'login', description: 'Failed-login lockout policy' },
  { id: 'session', description: 'Token lifetimes' },
  { id: 'apiKeys', description: 'API key limits' },
];

/** The source of truth for every configurable value in the system. */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: 'passwordPolicy.minLength',
    group: 'passwordPolicy',
    type: 'number',
    default: 8,
    min: 6,
    max: 64,
    description: 'Minimum password length',
  },
  {
    key: 'passwordPolicy.maxLength',
    group: 'passwordPolicy',
    type: 'number',
    default: 128,
    min: 8,
    max: 256,
    description: 'Maximum password length',
  },
  {
    key: 'passwordPolicy.requireUppercase',
    group: 'passwordPolicy',
    type: 'boolean',
    default: true,
    description: 'Require at least one uppercase letter',
  },
  {
    key: 'passwordPolicy.requireLowercase',
    group: 'passwordPolicy',
    type: 'boolean',
    default: true,
    description: 'Require at least one lowercase letter',
  },
  {
    key: 'passwordPolicy.requireDigit',
    group: 'passwordPolicy',
    type: 'boolean',
    default: true,
    description: 'Require at least one digit',
  },
  {
    key: 'passwordPolicy.requireSymbol',
    group: 'passwordPolicy',
    type: 'boolean',
    default: true,
    description: 'Require at least one symbol',
  },
  {
    key: 'passwordPolicy.historyCount',
    group: 'passwordPolicy',
    type: 'number',
    default: 3,
    min: 0,
    max: 20,
    description: 'Passwords that cannot be reused (0 disables the check)',
  },
  {
    key: 'passwordPolicy.expirationDays',
    group: 'passwordPolicy',
    type: 'number',
    default: 90,
    min: 0,
    max: 730,
    description: 'Days before a password expires (0 disables expiry)',
  },
  {
    key: 'login.maxFailedAttempts',
    group: 'login',
    type: 'number',
    default: 5,
    min: 0,
    max: 50,
    description: 'Failed attempts before the account is locked (0 disables lockout)',
  },
  {
    key: 'login.lockDurationMinutes',
    group: 'login',
    type: 'number',
    default: 15,
    min: 0,
    max: 1440,
    description: 'Minutes an account stays locked after too many failed attempts',
  },
  {
    key: 'session.accessTokenTtlMinutes',
    group: 'session',
    type: 'number',
    default: 15,
    min: 1,
    max: 1440,
    description: 'Access token lifetime in minutes',
  },
  {
    key: 'session.refreshTokenTtlDays',
    group: 'session',
    type: 'number',
    default: 7,
    min: 1,
    max: 365,
    description: 'Refresh token lifetime in days',
  },
  {
    key: 'apiKeys.defaultExpirationDays',
    group: 'apiKeys',
    type: 'number',
    default: 0,
    min: 0,
    max: 3650,
    description: 'Default API key lifetime in days (0 = no expiry)',
  },
  {
    key: 'apiKeys.maxKeysPerUser',
    group: 'apiKeys',
    type: 'number',
    default: 10,
    min: 1,
    max: 100,
    description: 'Maximum number of active API keys per user',
  },
];

const DEFINITIONS_BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export function findSettingDefinition(key: string): SettingDefinition | undefined {
  return DEFINITIONS_BY_KEY.get(key);
}

/** Reason why `value` is invalid for `definition`, or `null` when it is valid. */
export function validateSettingValue(definition: SettingDefinition, value: unknown): string | null {
  switch (definition.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return 'must be an integer';
      }

      if (definition.min !== undefined && value < definition.min) {
        return `must be >= ${definition.min}`;
      }

      if (definition.max !== undefined && value > definition.max) {
        return `must be <= ${definition.max}`;
      }

      return null;
    }
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'string':
      return typeof value === 'string' ? null : 'must be a string';
  }
}

/** Effective value of every definition, with stored values overlaid. */
export function mergeSettingValues(
  stored: Readonly<Record<string, SettingValue>>,
): Record<string, SettingValue> {
  const merged: Record<string, SettingValue> = {};

  for (const definition of SETTING_DEFINITIONS) {
    merged[definition.key] = stored[definition.key] ?? definition.default;
  }

  return merged;
}
