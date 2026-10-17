import { Rut } from '../../../shared/domain/rut.vo.js';
import { Telefono } from '../../../shared/domain/telefono.vo.js';
import type { SettingDefinition, SettingGroup, SettingValue } from './setting-definition.js';

/** UI groups of the settings form, in presentation order. */
export const SETTING_GROUPS: readonly SettingGroup[] = [
  { id: 'passwordPolicy', description: 'Password complexity, history and expiry' },
  { id: 'login', description: 'Failed-login lockout policy' },
  { id: 'session', description: 'Token lifetimes' },
  { id: 'apiKeys', description: 'API key limits' },
  { id: 'clinic', description: 'Clinic identity, contact details and theme' },
  { id: 'quotes', description: 'Quotations (Arancel UCO) behaviour' },
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
  {
    key: 'clinic.name',
    group: 'clinic',
    type: 'string',
    default: 'Mi clínica',
    maxLength: 60,
    description: 'Clinic display name (used by the shell, login and print headers)',
  },
  {
    key: 'clinic.slogan',
    group: 'clinic',
    type: 'string',
    default: '',
    maxLength: 120,
    description: 'Short tagline shown next to the name',
  },
  {
    key: 'clinic.legalName',
    group: 'clinic',
    type: 'string',
    default: '',
    maxLength: 120,
    description: 'Legal name (razón social) used on documents',
  },
  {
    key: 'clinic.rut',
    group: 'clinic',
    type: 'rut',
    default: '',
    description: 'Clinic RUT, stored canonical (`12345678-5`); empty when not configured',
  },
  {
    key: 'clinic.address.region',
    group: 'clinic',
    type: 'string',
    default: '',
    description: 'Region of the clinic address',
  },
  {
    key: 'clinic.address.comuna',
    group: 'clinic',
    type: 'string',
    default: '',
    description: 'Comuna of the clinic address',
  },
  {
    key: 'clinic.address.calle',
    group: 'clinic',
    type: 'string',
    default: '',
    description: 'Street of the clinic address',
  },
  {
    key: 'clinic.address.numero',
    group: 'clinic',
    type: 'string',
    default: '',
    description: 'Street number',
  },
  {
    key: 'clinic.address.oficina',
    group: 'clinic',
    type: 'string',
    default: '',
    description: 'Apartment or office, when the address has one',
  },
  {
    key: 'clinic.contact.phone',
    group: 'clinic',
    type: 'phone',
    default: '',
    description: 'Contact phone, stored canonical (`+56912345678`)',
  },
  {
    key: 'clinic.contact.email',
    group: 'clinic',
    type: 'email',
    default: '',
    description: 'Contact email',
  },
  {
    key: 'clinic.contact.website',
    group: 'clinic',
    type: 'url',
    default: '',
    description: 'Website (http/https)',
  },
  {
    key: 'clinic.theme.primary',
    group: 'clinic',
    type: 'color',
    default: '#0284c7',
    description: 'Primary brand color seed; the rest of the palette is derived',
  },
  {
    key: 'clinic.theme.accent',
    group: 'clinic',
    type: 'color',
    default: '#f59e0b',
    description: 'Accent brand color seed',
  },
  {
    key: 'clinic.theme.mode',
    group: 'clinic',
    type: 'enum',
    default: 'auto',
    values: ['light', 'auto'],
    description: 'Color mode: always light or follow the operating system',
  },
  {
    key: 'clinic.logo.version',
    group: 'clinic',
    type: 'number',
    default: 0,
    min: 0,
    max: 1_000_000,
    managed: true,
    description: 'Current logo version; only the clinic module writes it',
  },
  {
    key: 'quotes.ucoRate',
    group: 'quotes',
    type: 'number',
    default: 3000,
    min: 1,
    max: 10_000_000,
    description: 'CLP value of a single UCO unit (used to propose line prices)',
  },
  {
    key: 'quotes.folioPrefix',
    group: 'quotes',
    type: 'string',
    default: 'COT',
    maxLength: 8,
    description: 'Prefix of the quote folio (e.g. `COT`)',
  },
  {
    key: 'quotes.defaultValidityDays',
    group: 'quotes',
    type: 'number',
    default: 30,
    min: 1,
    max: 3650,
    description: 'Default validity of a quote, in days',
  },
];

const DEFINITIONS_BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export function findSettingDefinition(key: string): SettingDefinition | undefined {
  return DEFINITIONS_BY_KEY.get(key);
}

/** Result of validating and normalizing one value. */
export type SettingCoercion =
  | { readonly ok: true; readonly value: SettingValue }
  | { readonly ok: false; readonly reason: string };

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/**
 * Validates `value` against `definition` and returns the *normalized* value
 * to store: colors lower-cased, RUTs canonical (`12345678-5`), phones in
 * `+56…` form, emails trimmed/lower-cased. Every text-like kind accepts the
 * empty string — "not configured" is a first-class state (e.g.
 * `clinic.contact.email` starts empty).
 */
export function coerceSettingValue(
  definition: SettingDefinition,
  value: unknown,
): SettingCoercion {
  switch (definition.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return invalid('must be an integer');
      }

      if (definition.min !== undefined && value < definition.min) {
        return invalid(`must be >= ${definition.min}`);
      }

      if (definition.max !== undefined && value > definition.max) {
        return invalid(`must be <= ${definition.max}`);
      }

      return { ok: true, value };
    }
    case 'boolean':
      return typeof value === 'boolean' ? { ok: true, value } : invalid('must be a boolean');
    case 'string': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      if (definition.maxLength !== undefined && value.length > definition.maxLength) {
        return invalid(`must have at most ${definition.maxLength} characters`);
      }

      return { ok: true, value };
    }
    case 'color': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      const normalized = value.trim().toLowerCase();

      return HEX_COLOR_PATTERN.test(normalized)
        ? { ok: true, value: normalized }
        : invalid('must be a #rrggbb hex color');
    }
    case 'email': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      const normalized = value.trim().toLowerCase();

      if (normalized === '') {
        return { ok: true, value: '' };
      }

      return normalized.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(normalized)
        ? { ok: true, value: normalized }
        : invalid('must be an email address');
    }
    case 'url': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      const normalized = value.trim();

      return normalized === '' || isHttpUrl(normalized)
        ? { ok: true, value: normalized }
        : invalid('must be an http(s) URL');
    }
    case 'rut': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      if (value.trim() === '') {
        return { ok: true, value: '' };
      }

      try {
        return { ok: true, value: Rut.create(value).value };
      } catch {
        return invalid('must be a valid Chilean RUT');
      }
    }
    case 'phone': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      if (value.trim() === '') {
        return { ok: true, value: '' };
      }

      try {
        return { ok: true, value: Telefono.create(value).value };
      } catch {
        return invalid('must be a valid Chilean phone number');
      }
    }
    case 'enum': {
      const allowed = definition.values ?? [];

      return typeof value === 'string' && allowed.includes(value)
        ? { ok: true, value }
        : invalid(`must be one of: ${allowed.join(', ')}`);
    }
  }
}

function invalid(reason: string): SettingCoercion {
  return { ok: false, reason };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
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
