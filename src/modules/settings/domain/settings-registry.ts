import { Rut } from '../../../shared/domain/rut.vo.js';
import { Telefono } from '../../../shared/domain/telefono.vo.js';
import { ACTIVITY_SETTING_DEFINITIONS, ACTIVITY_SETTING_GROUPS } from '../../activity/domain/activity-settings.js';
import { AGENDA_SETTING_DEFINITIONS, AGENDA_SETTING_GROUPS } from '../../agenda/domain/agenda-settings.js';
import { AUTH_SETTING_DEFINITIONS, AUTH_SETTING_GROUPS } from '../../auth/domain/auth-settings.js';
import { CARO_IA_SETTING_DEFINITIONS, CARO_IA_SETTING_GROUPS } from '../../caro-ia/domain/caro-ia-settings.js';
import { CLINIC_SETTING_DEFINITIONS, CLINIC_SETTING_GROUPS } from '../../clinic/domain/clinic-settings.js';
import { MCP_SETTING_DEFINITIONS, MCP_SETTING_GROUPS } from '../../mcp/domain/mcp-settings.js';
import { QUOTES_SETTING_DEFINITIONS, QUOTES_SETTING_GROUPS } from '../../quotes/domain/quotes-settings.js';
import type { SettingDefinition, SettingGroup, SettingValue } from './setting-definition.js';
import { UI_SETTING_DEFINITIONS, UI_SETTING_GROUPS } from './ui-settings.js';

/**
 * The source of truth for every configurable value in the system, composed
 * from the definitions each owning module registers. Every module owns its
 * keys (auth → security policy, agenda → notifications, ...); this file is
 * only the engine that aggregates them for validation, storage and the panel.
 * UI groups are listed in presentation order.
 */
export const SETTING_GROUPS: readonly SettingGroup[] = [
  ...AUTH_SETTING_GROUPS,
  ...CLINIC_SETTING_GROUPS,
  ...QUOTES_SETTING_GROUPS,
  ...ACTIVITY_SETTING_GROUPS,
  ...MCP_SETTING_GROUPS,
  ...CARO_IA_SETTING_GROUPS,
  ...AGENDA_SETTING_GROUPS,
  ...UI_SETTING_GROUPS,
];

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  ...AUTH_SETTING_DEFINITIONS,
  ...CLINIC_SETTING_DEFINITIONS,
  ...QUOTES_SETTING_DEFINITIONS,
  ...ACTIVITY_SETTING_DEFINITIONS,
  ...MCP_SETTING_DEFINITIONS,
  ...CARO_IA_SETTING_DEFINITIONS,
  ...AGENDA_SETTING_DEFINITIONS,
  ...UI_SETTING_DEFINITIONS,
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
    case 'html': {
      if (typeof value !== 'string') {
        return invalid('must be a string');
      }

      if (definition.maxLength !== undefined && value.length > definition.maxLength) {
        return invalid(`must have at most ${definition.maxLength} characters`);
      }

      return { ok: true, value };
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
