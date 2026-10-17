import type { SettingValue } from './setting-definition.js';
import { SettingsValueInvalidError } from './settings.errors.js';

/** Envelope of `GET /settings/export`; `POST /settings/import` accepts it as-is. */
export interface SettingsExportEnvelope {
  app: 'hexa';
  version: number;
  exportedAt: string;
  values: Record<string, SettingValue>;
}

/** Current export format. Imports from a newer format are rejected. */
export const SETTINGS_EXPORT_VERSION = 1;

/**
 * Validates an imported envelope defensively — the body is user input — and
 * returns its raw `values` map, ready for the settings validator. Only the
 * shape is checked here: keys and values are the registry's business.
 */
export function parseSettingsImport(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('must be the exported JSON object');
  }

  const envelope = value as { app?: unknown; version?: unknown; values?: unknown };

  if (envelope.app !== undefined && envelope.app !== 'hexa') {
    return fail('is not a hexa settings export');
  }

  if (
    envelope.version !== undefined &&
    (typeof envelope.version !== 'number' || envelope.version > SETTINGS_EXPORT_VERSION)
  ) {
    return fail(`was exported by a newer version (this app understands ${SETTINGS_EXPORT_VERSION})`);
  }

  const values = envelope.values;

  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return fail('must be an object mapping setting keys to values');
  }

  return values as Record<string, unknown>;
}

function fail(reason: string): never {
  throw new SettingsValueInvalidError([{ key: 'values', reason }]);
}
