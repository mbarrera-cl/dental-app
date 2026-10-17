import type { SettingsAuditEntry, SettingsAuditRecord } from '../../domain/settings-audit.js';

/**
 * Driven port: append-only trail of configuration changes. The adapter
 * resolves `actorEmail` from the users table at read time, so no account
 * data is duplicated here.
 */
export abstract class SettingsAuditRepositoryPort {
  abstract append(record: SettingsAuditRecord): Promise<void>;

  /** Newest first, at most `limit` entries. */
  abstract list(limit: number): Promise<SettingsAuditEntry[]>;
}
