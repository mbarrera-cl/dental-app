/**
 * Configurable settings (`GET /settings`, mirrors `setting-response.dto.ts`).
 * The admin panel renders its dynamic form from this shape alone: every
 * definition carries type, current value, default and bounds.
 */

export type SettingType = 'number' | 'boolean' | 'string';
export type SettingValue = number | boolean | string;

export interface Setting {
  key: string;
  group: string;
  type: SettingType;
  value: SettingValue;
  default: SettingValue;
  min?: number;
  max?: number;
  description: string;
}

/** Map of `key -> value` accepted by `PATCH /settings`. */
export type SettingsValues = Record<string, SettingValue>;

export interface UpdateSettingsPayload {
  values: SettingsValues;
}
