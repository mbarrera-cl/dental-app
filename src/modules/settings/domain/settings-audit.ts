import type { SettingValue } from './setting-definition.js';

/** One setting that actually changed, with its values before and after. */
export interface SettingChange {
  key: string;
  /** Effective value before the write; `null` when the key had no value. */
  from: SettingValue | null;
  to: SettingValue;
}

/** Who wrote a configuration change. */
export interface SettingsAuditActor {
  id: string;
  type: 'user' | 'apikey';
}

/** A persisted configuration change (who, when and what moved). */
export interface SettingsAuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorType: 'user' | 'apikey';
  /** Resolved at read time (`users.email`); null for API keys or deleted users. */
  actorEmail: string | null;
  changes: readonly SettingChange[];
}

/** Record about to be persisted: the repository assigns id and resolves email. */
export type SettingsAuditRecord = Omit<SettingsAuditEntry, 'id' | 'actorEmail'>;

/**
 * Keys whose value moved, comparing the touched subset (`after`) against the
 * effective values before the write; the order follows `after`.
 */
export function diffSettingValues(
  before: Readonly<Record<string, SettingValue>>,
  after: Readonly<Record<string, SettingValue>>,
): SettingChange[] {
  return Object.entries(after)
    .filter(([key, value]) => before[key] !== value)
    .map(([key, value]) => ({ key, from: before[key] ?? null, to: value }));
}
