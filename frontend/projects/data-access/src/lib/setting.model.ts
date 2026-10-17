/**
 * Configurable settings (`GET /settings`, mirrors `setting-response.dto.ts`).
 * The admin panel renders its dynamic form from this shape alone: every
 * definition carries type, current value, default and bounds.
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

export interface Setting {
  key: string;
  group: string;
  type: SettingType;
  value: SettingValue;
  default: SettingValue;
  min?: number;
  max?: number;
  /** Longest accepted value for text-like settings. */
  maxLength?: number;
  /** Allowed values of an `enum` setting. */
  values?: string[];
  /** Managed settings are written by their own module, never by `PATCH`. */
  managed?: boolean;
  description: string;
}

/** Map of `key -> value` accepted by `PATCH /settings`. */
export type SettingsValues = Record<string, SettingValue>;

export interface UpdateSettingsPayload {
  values: SettingsValues;
}

/** One setting that actually changed, with its values before and after. */
export interface SettingChange {
  key: string;
  /** Effective value before the write; `null` when the key had no value. */
  from: SettingValue | null;
  to: SettingValue;
}

/** A configuration change recorded by the backend (`GET /settings/audit`). */
export interface SettingsAuditEntry {
  id: string;
  /** ISO timestamp of the write. */
  at: string;
  actorId: string;
  actorType: 'user' | 'apikey';
  /** Resolved by the backend; null for API keys or deleted users. */
  actorEmail: string | null;
  changes: SettingChange[];
}

/**
 * Transferable configuration envelope (`GET /settings/export`): every
 * editable setting, ready to POST back to `POST /settings/import`.
 */
export interface SettingsExport {
  app: 'hexa';
  version: number;
  exportedAt: string;
  values: SettingsValues;
}

export interface ImportSettingsPayload {
  values: SettingsValues;
}
